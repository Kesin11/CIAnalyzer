import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { GithubClient } from "../client/github_client"
import { GithubAnalyzer } from "../analyzer/github_analyzer"
import { GithubConfig, parseConfig } from "../config/github_config"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"
import { CustomReportCollection, createCustomReportCollection } from "../custom_report_collection"
import { failure, Result, success } from "../result"

export class GithubRunner implements Runner {
  service: string = 'github'
  client: GithubClient
  analyzer: GithubAnalyzer 
  configDir: string
  config: GithubConfig | undefined
  store?: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.configDir = yamlConfig.configDir
    this.config = parseConfig(yamlConfig)
    this.client = new GithubClient(GITHUB_TOKEN, this.config?.vscBaseUrl?.github)
    this.analyzer = new GithubAnalyzer()
  }

  private setRepoLastRun(reponame: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store?.setLastRun(reponame, lastRunReport.buildNumber)
    }
  }

  async run (): Promise<Result<void, Error>> {
    let result: Result<void, Error> = success()
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
        const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, lastRunId)
        const tagMap = await this.client.fetchRepositoryTagMap(repo.owner, repo.repo)

        for (const workflowRun of workflowRuns) {
          // Fetch data
          const jobs = await this.client.fetchJobs(repo.owner, repo.repo, workflowRun.run.id)
          const tests = await this.client.fetchTests(repo.owner, repo.repo, workflowRun.run.id, repo.testGlob)
          const customReportArtifacts = await this.client.fetchCustomReports(repo.owner, repo.repo, workflowRun.run.id, repo.customReports)

          // Create report
          const workflowReport = this.analyzer.createWorkflowReport(workflowRun.name, workflowRun.run, jobs, tagMap)
          const testReports = await this.analyzer.createTestReports(workflowReport, tests)
          const runCustomReportCollection = await createCustomReportCollection(workflowReport, customReportArtifacts)

          // Aggregate
          repoWorkflowReports.push(workflowReport)
          repoTestReports = repoTestReports.concat(testReports)
          customReportCollection.aggregate(runCustomReportCollection)
        }
      }
      catch (error) {
        const errorMessage = `Some error raised in '${repo.fullname}', so it skipped.`
        console.error(errorMessage)
        console.error(error)
        result = failure(new Error(errorMessage))
        continue
      }
      this.setRepoLastRun(repo.fullname, repoWorkflowReports)
      workflowReports = workflowReports.concat(repoWorkflowReports)
      testReports = testReports.concat(repoTestReports)
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
