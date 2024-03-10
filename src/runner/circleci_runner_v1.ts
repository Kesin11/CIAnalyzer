import { maxBy } from "lodash"
import { Runner } from "./runner.js"
import { ValidatedYamlConfig } from "../config/config.js"
import { CircleciClient } from "../client/circleci_client.js"
import { CircleciAnalyzer } from "../analyzer/circleci_analyzer.js"
import { CircleciConfig, parseConfig } from "../config/circleci_config.js"
import { WorkflowReport, TestReport } from "../analyzer/analyzer.js"
import { CompositExporter } from "../exporter/exporter.js"
import { LastRunStore } from "../last_run_store.js"
import { GithubClient } from "../client/github_client.js"
import { CustomReportCollection, createCustomReportCollection, aggregateCustomReportArtifacts } from "../custom_report_collection.js"
import { failure, Result, success } from "../result.js"
import { ArgumentOptions } from "../arg_options.js"
import { Logger } from "tslog"

const META_VERSION = 1
export type CircleciV1LastRunMetadata = {
  version: number
}

export class CircleciRunnerV1 implements Runner {
  service: string = 'circleci'
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  config: CircleciConfig | undefined
  store?: LastRunStore<CircleciV1LastRunMetadata>
  githubClient: GithubClient
  logger: Logger<unknown>

  constructor(logger: Logger<unknown>, public yamlConfig: ValidatedYamlConfig, public options: ArgumentOptions) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.logger = logger.getSubLogger({ name: `${CircleciRunnerV1.name}` })
    this.client = new CircleciClient(CIRCLECI_TOKEN, this.logger, options, this.config?.baseUrl)
    this.analyzer = new CircleciAnalyzer()

    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.githubClient = new GithubClient(GITHUB_TOKEN, options, this.config?.vcsBaseUrl?.github)
  }

  async isHostAvailableVersion(): Promise<Result<unknown, Error>> {
    return success(`${this.config?.baseUrl} available API v1.1`)
  }

  private setRepoLastRun(reponame: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store?.setLastRun(reponame, lastRunReport.buildNumber)
    }
  }

  async run (): Promise<Result<unknown, Error>> {
    let result: Result<unknown, Error> = success(this.service)
    if (!this.config) return failure(new Error('this.config must not be undefined'))
    this.store = await LastRunStore.init(this.logger, this.options, this.service, this.config.lastRunStore)

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const repo of this.config.repos) {
      this.logger.info(`Fetching ${this.service} - ${repo.fullname} ...`)
      const repoWorkflowReports: WorkflowReport[] = []
      let repoTestReports: TestReport[] = []

      try {
        this.migrateLastRun(repo.fullname)
        const lastRunId = this.store.getLastRun(repo.fullname)
        const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vcsType, lastRunId)
        const tagMap = await this.githubClient.fetchRepositoryTagMap(repo.owner, repo.repo)

        for (const workflowRun of workflowRuns) {
          // Fetch data
          const jobs = await Promise.all(workflowRun.build_nums.map((buildNum) => {
            return this.client.fetchJobs(
              workflowRun.username,
              workflowRun.reponame,
              workflowRun.vcs_type,
              buildNum
              )
          }))
          const tests = await Promise.all(workflowRun.build_nums.map((buildNum) => {
            return this.client.fetchTests(
              workflowRun.username,
              workflowRun.reponame,
              workflowRun.vcs_type,
              buildNum
            )
          }))
          const customReportArtifactsList = await Promise.all(workflowRun.build_nums.map((buildNum) => {
            return this.client.fetchCustomReports(
              workflowRun.username,
              workflowRun.reponame,
              workflowRun.vcs_type,
              buildNum,
              repo.customReports,
            )
          }))
          const customReportArtifacts = aggregateCustomReportArtifacts(customReportArtifactsList)

          // Create report
          const workflowReport = this.analyzer.createWorkflowReport(workflowRun, jobs, tagMap)
          const testReports = await this.analyzer.createTestReports(workflowReport, jobs, tests)
          const runCustomReportCollection = await createCustomReportCollection(workflowReport, customReportArtifacts)

          // Aggregate
          repoWorkflowReports.push(workflowReport)
          repoTestReports = repoTestReports.concat(testReports)
          customReportCollection.aggregate(runCustomReportCollection)
        }

        this.setRepoLastRun(repo.fullname, repoWorkflowReports)
        workflowReports = workflowReports.concat(repoWorkflowReports)
        testReports = testReports.concat(repoTestReports)
      }
      catch (error) {
        const errorMessage = `Some error raised in '${repo.fullname}', so it skipped.`
        this.logger.error(errorMessage)
        result = failure(new Error(errorMessage, { cause: error as Error }))
        continue
      }
    }

    this.logger.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.logger, this.options, this.service, this.config.exporter)
    await exporter.exportWorkflowReports(workflowReports)
    await exporter.exportTestReports(testReports)
    await exporter.exportCustomReports(customReportCollection)

    this.store.save()
    this.logger.info(`Done execute '${this.service}'. status: ${result.type}`)

    return result
  }

  migrateLastRun(repoFullname: string) {
    const metadata = this.store?.getMeta(repoFullname)
    if (metadata === undefined || metadata.version <= META_VERSION) {
        this.store?.setMeta(repoFullname, { version: META_VERSION })
    }
    else if (metadata.version > META_VERSION) {
      throw new Error(`${repoFullname} was executed with ${metadata.version} that is newer than ${CircleciRunnerV1.name}`)
    }
  }
}
