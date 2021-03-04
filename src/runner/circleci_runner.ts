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

export class CircleciRunner implements Runner {
  service: string = 'circleci'
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  configDir: string
  config: CircleciConfig | undefined
  store?: LastRunStore
  githubClient: GithubClient
  constructor(public yamlConfig: YamlConfig) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.configDir = yamlConfig.configDir
    this.config = parseConfig(yamlConfig)
    this.client = new CircleciClient(CIRCLECI_TOKEN, this.config?.baseUrl)
    this.analyzer = new CircleciAnalyzer()

    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.githubClient = new GithubClient(GITHUB_TOKEN, this.config?.vscBaseUrl?.github)
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
    this.store = await LastRunStore.init(this.service, this.configDir, this.config.lastRunStore)

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const repo of this.config.repos) {
      console.info(`Fetching ${this.service} - ${repo.fullname} ...`)
      const repoWorkflowReports: WorkflowReport[] = []
      let repoTestReports: TestReport[] = []

      try {
        const lastRunId = this.store.getLastRun(repo.fullname)
        const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vscType, lastRunId)
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
        console.error(errorMessage)
        console.error(error)
        result = failure(new Error(errorMessage))
        continue
      }
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.service, this.configDir, this.config.exporter)
    await exporter.exportWorkflowReports(workflowReports)
    await exporter.exportTestReports(testReports)
    await exporter.exportCustomReports(customReportCollection)

    this.store.save()
    console.info(`Done execute '${this.service}'. status: ${result.type}`)

    return result
  }
}
