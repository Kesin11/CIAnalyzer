import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { JenkinsClient } from "../client/jenkins_client"
import { JenkinsAnalyzer } from "../analyzer/jenkins_analyzer"
import { JenkinsConfig, parseConfig } from "../config/jenkins_config"
import { LastRunStore } from "../last_run_store"

export class JenkinsRunner implements Runner {
  client: JenkinsClient | undefined
  analyzer: JenkinsAnalyzer 
  config: JenkinsConfig | undefined
  store: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    this.config = parseConfig(yamlConfig)
    this.analyzer = new JenkinsAnalyzer()
    this.store = new LastRunStore('jenkins', this.config?.lastRunStore)

    if (!this.config) return
    const JENKINS_USER = process.env['JENKINS_USER']
    const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
    this.client = new JenkinsClient(this.config.baseUrl, JENKINS_USER, JENKINS_TOKEN)
  }

  private setRepoLastRun(jobname: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store.setLastRun(jobname, lastRunReport.buildNumber)
    }
  }

  async run () {
    if (!this.config) return
    if (!this.client) return

    const allJobs = await this.client.fetchJobs()
    const configJobs = this.config.jobs
    const jobs = allJobs.filter((job) => configJobs.includes(job.name))

    let reports: WorkflowReport[] = []
    for (const job of jobs) {
      const repoReports: WorkflowReport[] = []
      const fromRunId = this.store.getLastRun(job.name)
      const runs = await this.client.fetchJobRuns(job, fromRunId)

      for (const run of runs) {
        const build = await this.client.fetchBuild(job, Number(run.id))
        const report = this.analyzer.createWorkflowReport(job.name, run, build)

        repoReports.push(report)
      }

      this.setRepoLastRun(job.name, repoReports)
      reports = reports.concat(reports, repoReports)
    }

    const exporter = new CompositExporter('jenkins', this.config.exporter)
    await exporter.exportReports(reports)

    this.store.save()
  }
}
