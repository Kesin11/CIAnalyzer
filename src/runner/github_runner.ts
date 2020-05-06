import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { GithubClient } from "../client/github_client"
import { GithubAnalyzer } from "../analyzer/github_analyzer"
import { GithubConfig, parseConfig } from "../config/github_config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"

export class GithubRunner implements Runner {
  service: string = 'github'
  client: GithubClient
  analyzer: GithubAnalyzer 
  config: GithubConfig | undefined
  store: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new GithubClient(GITHUB_TOKEN)
    this.analyzer = new GithubAnalyzer()
    this.store = new LastRunStore('github', this.config?.lastRunStore)
  }

  private setRepoLastRun(reponame: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store.setLastRun(reponame, lastRunReport.buildNumber)
    }
  }

  async run () {
    if (!this.config) return

    let reports: WorkflowReport[] = []
    for (const repo of this.config.repos) {
      console.info(`Fetching ${this.service} - ${repo.fullname} ...`)
      const repoReports: WorkflowReport[] = []
      const fromRunId = this.store.getLastRun(repo.fullname)
      const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, fromRunId)

      for (const workflowRun of workflowRuns) {
        const jobs = await this.client.fetchJobs(repo.owner, repo.repo, workflowRun.run.id)
        const report = this.analyzer.createWorkflowReport(workflowRun.name, workflowRun.run, jobs)

        repoReports.push(report)
      }

      this.setRepoLastRun(repo.fullname, repoReports)
      reports = reports.concat(repoReports)
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.service, this.config.exporter)
    await exporter.exportReports(reports)

    this.store.save()
    console.info(`Success: done execute '${this.service}'`)
  }
}
