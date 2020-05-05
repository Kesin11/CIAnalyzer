import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { CircleciClient } from "../client/circleci_client"
import { CircleciAnalyzer } from "../analyzer/circleci_analyzer"
import { CircleciConfig, parseConfig } from "../config/circleci_config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"

export class CircleciRunner implements Runner {
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  config: CircleciConfig | undefined
  store: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new CircleciClient(CIRCLECI_TOKEN, this.config?.baseUrl)
    this.analyzer = new CircleciAnalyzer()
    this.store = new LastRunStore('circleci', this.config?.lastRunStore)
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
      const repoReports: WorkflowReport[] = []
      const fromRunId = this.store.getLastRun(repo.fullname)
      const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vscType, fromRunId)

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

        repoReports.push(report)
      }

      this.setRepoLastRun(repo.fullname, repoReports)
      reports = reports.concat(repoReports)
    }

    const exporter = new CompositExporter('circleci', this.config.exporter)
    await exporter.exportReports(reports)

    this.store.save()
  }
}
