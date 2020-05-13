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
  service: string = 'jenkins'
  client: JenkinsClient | undefined
  analyzer: JenkinsAnalyzer 
  config: JenkinsConfig | undefined
  store?: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    this.config = parseConfig(yamlConfig)
    this.analyzer = new JenkinsAnalyzer()

    if (!this.config) return
    const JENKINS_USER = process.env['JENKINS_USER']
    const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
    this.client = new JenkinsClient(this.config.baseUrl, JENKINS_USER, JENKINS_TOKEN)
  }

  private setRepoLastRun(jobname: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store?.setLastRun(jobname, lastRunReport.buildNumber)
    }
  }

  async run () {
    if (!this.config) return
    if (!this.client) return
    this.store = await LastRunStore.init(this.service, this.config?.lastRunStore)

    const allJobs = await this.client.fetchJobs()
    const configJobs = this.config.jobs
    const jobs = allJobs.filter((job) => configJobs.includes(job.name))

    let reports: WorkflowReport[] = []
    for (const job of jobs) {
      console.info(`Fetching ${this.service} - ${job.name} ...`)
      const jobReports: WorkflowReport[] = []

      try {
        const fromRunId = this.store.getLastRun(job.name)
        const runs = await this.client.fetchJobRuns(job, fromRunId)

        for (const run of runs) {
          const build = await this.client.fetchBuild(job, Number(run.id))
          const report = this.analyzer.createWorkflowReport(job.name, run, build)

          jobReports.push(report)
        }

        this.setRepoLastRun(job.name, jobReports)
        reports = reports.concat(jobReports)
      }
      catch (error) {
        console.error(`Some error raised in '${job.name}', so it skipped.`)
        console.error(error)
        continue
      }
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.service, this.config.exporter)
    await exporter.exportReports(reports)

    this.store.save()
    console.info(`Success: done execute '${this.service}'`)
  }
}
