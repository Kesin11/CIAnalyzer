import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { CircleciClient } from "../client/Circleci_client"
import { CircleciAnalyzer } from "../analyzer/Circleci_analyzer"
import { CircleciConfig, parseConfig } from "../config/Circleci_config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"

export class CircleciRunner implements Runner {
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  config: CircleciConfig | undefined
  constructor(public yamlConfig: YamlConfig) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new CircleciClient(CIRCLECI_TOKEN)
    this.analyzer = new CircleciAnalyzer()
  }

  async run () {
    if (!this.config) return

    const reports: WorkflowReport[] = []
    for (const repo of this.config.repos) {
      const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vscType)
      for (const workflowRun of workflowRuns) {
        const jobs = await Promise.all(workflowRun.build_nums.map((buildNum) => {
          return this.client.fetchJobs(
            workflowRun.username,
            workflowRun.reponame,
            workflowRun.vcs_type,
            buildNum
            )
        }))
        const report = this.analyzer.createWorkflowReport(workflowRun, jobs)
        reports.push(report)
      }
    }

    const exporter = new CompositExporter('circleci', this.config.exporter)
    await exporter.exportReports(reports)
  }
}