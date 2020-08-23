import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { JenkinsClient } from "../client/jenkins_client"
import { JenkinsAnalyzer } from "../analyzer/jenkins_analyzer"
import { JenkinsConfig, parseConfig } from "../config/jenkins_config"
import { LastRunStore } from "../last_run_store"
import { CustomReportCollection } from "../custom_report_collector"

export class JenkinsRunner implements Runner {
  service: string = 'jenkins'
  client: JenkinsClient | undefined
  analyzer: JenkinsAnalyzer 
  configDir: string
  config: JenkinsConfig | undefined
  store?: LastRunStore
  constructor(public yamlConfig: YamlConfig) {
    this.configDir = yamlConfig.configDir
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
    this.store = await LastRunStore.init(this.service, this.configDir, this.config.lastRunStore)

    const allJobs = await this.client.fetchJobs()
    const allJobMap = new Map(allJobs.map((job) => [job.name, job]))
    const configJobs = this.config.jobs.filter((job) => allJobMap.get(job.name))

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const configJob of configJobs) {
      console.info(`Fetching ${this.service} - ${configJob.name} ...`)
      const jobReports: WorkflowReport[] = []
      let jobTestReports: TestReport[] = []

      try {
        const lastRunId = this.store.getLastRun(configJob.name)
        const runs = await this.client.fetchJobRuns(configJob.name, lastRunId)

        for (const run of runs) {
          // Fetch data
          const build = await this.client.fetchBuild(configJob.name, Number(run.id))
          const tests = await this.client.fetchTests(build, configJob.testGlob)
          const customReportArtifacts = await this.client.fetchCustomReports(build, configJob.customReports)

          // Create report
          const report = this.analyzer.createWorkflowReport(configJob.name, run, build)
          const testReports = await this.analyzer.createTestReports(report, tests)
          const runCustomReportCollection = await this.analyzer.createCustomReportCollection(report, customReportArtifacts)

          // Aggregate
          jobReports.push(report)
          jobTestReports = jobTestReports.concat(testReports)
          customReportCollection.aggregate(runCustomReportCollection)
        }

        this.setRepoLastRun(configJob.name, jobReports)
        workflowReports = workflowReports.concat(jobReports)
        testReports = testReports.concat(jobTestReports)
      }
      catch (error) {
        console.error(`Some error raised in '${configJob.name}', so it skipped.`)
        console.error(error)
        continue
      }
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.service, this.configDir, this.config.exporter)
    await exporter.exportWorkflowReports(workflowReports)
    await exporter.exportTestReports(testReports)
    // TODO: await exporter.exportCustomReports(customReports)

    this.store.save()
    console.info(`Success: done execute '${this.service}'`)
  }
}
