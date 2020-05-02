import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { GithubClient } from "../client/github_client"
import { GithubAnalyzer } from "../analyzer/github_analyzer"
import { GithubConfig, parseConfig } from "../config/github_config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"

export class GithubRunner implements Runner {
  client: GithubClient
  analyzer: GithubAnalyzer 
  config: GithubConfig | undefined
  constructor(public yamlConfig: YamlConfig) {
    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new GithubClient(GITHUB_TOKEN)
    this.analyzer = new GithubAnalyzer()
  }

  async run () {
    if (!this.config) return

    const reports: WorkflowReport[] = []
    for (const repo of this.config.repos) {
      const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo)
      for (const workflowRun of workflowRuns) {
        const jobs = await this.client.fetchJobs(repo.owner, repo.repo, workflowRun.run.id)
        const report = this.analyzer.createWorkflowReport(workflowRun.name, workflowRun.run, jobs)

        reports.push(report)
      }
    }

    const exporter = new CompositExporter('github', this.config.exporter)
    await exporter.exportReports(reports)
  }
}