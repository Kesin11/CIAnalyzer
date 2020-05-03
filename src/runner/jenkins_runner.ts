import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { JenkinsClient } from "../client/jenkins_client"
import { JenkinsAnalyzer } from "../analyzer/jenkins_analyzer"
import { JenkinsConfig, parseConfig } from "../config/jenkins_config"

export class JenkinsRunner implements Runner {
  client: JenkinsClient | undefined
  analyzer: JenkinsAnalyzer 
  config: JenkinsConfig | undefined
  constructor(public yamlConfig: YamlConfig) {
    this.config = parseConfig(yamlConfig)
    this.analyzer = new JenkinsAnalyzer()

    if (!this.config) return
    const JENKINS_USER = process.env['JENKINS_USER']
    const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
    this.client = new JenkinsClient(this.config.baseUrl, JENKINS_USER, JENKINS_TOKEN)
  }

  async run () {
    if (!this.config) return
    if (!this.client) return

    const allJobs = await this.client.fetchJobs()
    const configJobs = this.config.jobs
    const jobs = allJobs.filter((job) => configJobs.includes(job.name))

    const reports: WorkflowReport[] = []
    for (const job of jobs) {
      const runs = await this.client.fetchJobRuns(job)
      for (const run of runs) {
        const build = await this.client.fetchBuild(job, Number(run.id))
        const report = this.analyzer.createWorkflowReport(job.name, run, build)

        reports.push(report)
      }
    }
    const exporter = new CompositExporter('jenkins', this.config.exporter)
    await exporter.exportReports(reports)
  }
}