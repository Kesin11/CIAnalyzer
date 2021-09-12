import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { CircleciClient } from "../client/circleci_client"
import { CircleciAnalyzer } from "../analyzer/circleci_analyzer"
import { CircleciConfig, parseConfig } from "../config/circleci_config"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"
import { GithubClient } from "../client/github_client"
import { CustomReportCollection, createCustomReportCollection, aggregateCustomReportArtifacts } from "../custom_report_collection"
import { failure, Result, success } from "../result"
import { ArgumentOptions } from "../arg_options"
import { Logger } from "tslog"

export class CircleciRunnerV1 implements Runner {
  service: string = 'circleci'
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  config: CircleciConfig | undefined
  store?: LastRunStore
  githubClient: GithubClient
  logger: Logger

  constructor(logger: Logger, public yamlConfig: YamlConfig, public options: ArgumentOptions) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.logger = logger.getChildLogger({ name: CircleciRunnerV1.name, instanceName: this.service })
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
        this.logger.error(error)
        result = failure(new Error(errorMessage))
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
}
