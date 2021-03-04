import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { BuildResponse, JenkinsClient } from "../client/jenkins_client"
import { JenkinsAnalyzer } from "../analyzer/jenkins_analyzer"
import { JenkinsConfig, JenkinsConfigJob, parseConfig } from "../config/jenkins_config"
import { LastRunStore } from "../last_run_store"
import { CustomReportCollection, createCustomReportCollection } from "../custom_report_collection"
import { failure, Result, success } from "../result"

export class JenkinsRunner implements Runner {
  service: string = 'jenkins'
  client?: JenkinsClient
  analyzer: JenkinsAnalyzer 
  configDir: string
  config?: JenkinsConfig
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

  async run (): Promise<Result<unknown, Error>> {
    let result: Result<unknown, Error> = success(this.service)
    if (!this.config) return failure(new Error('this.config must not be undefined'))
    if (!this.client) return failure(new Error('this.client must not be undefined'))
    this.store = await LastRunStore.init(this.service, this.configDir, this.config.lastRunStore)

    const jobs = await this.getJobs()

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const job of jobs) {
      console.info(`Fetching ${this.service} - ${job.name} ...`)
      const jobReports: WorkflowReport[] = []
      let jobTestReports: TestReport[] = []

      try {
        const lastRunId = this.store.getLastRun(job.name)
        const runs = await this.client.fetchJobRuns(job.name, lastRunId)

        for (const run of runs) {
          // Fetch data
          const build = await this.client.fetchBuild(job.name, Number(run.id))
          const tests = await this.client.fetchTests(build, job.testGlob)
          const customReportArtifacts = await this.client.fetchCustomReports(build, job.customReports)

          // Create report
          const report = this.analyzer.createWorkflowReport(job.name, run, build)
          const testReports = await this.analyzer.createTestReports(report, tests)
          const runCustomReportCollection = await createCustomReportCollection(report, customReportArtifacts)

          // Aggregate
          jobReports.push(report)
          jobTestReports = jobTestReports.concat(testReports)
          customReportCollection.aggregate(runCustomReportCollection)
        }

        this.setRepoLastRun(job.name, jobReports)
        workflowReports = workflowReports.concat(jobReports)
        testReports = testReports.concat(jobTestReports)
      }
      catch (error) {
        const errorMessage = `Some error raised in '${job.name}', so it skipped.`
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

  private async getJobs(): Promise<JenkinsConfigJob[]> {
    if (!this.config) return []
    if (!this.client) return []

    const allJobs = await this.client.fetchJobs()
    const allJobMap = new Map(allJobs.map((job) => [job.name, job]))
    const configJobs = this.config.jobs.filter((job) => allJobMap.get(job.name))

    const otherJobs: JenkinsConfigJob[] = []
    if (this.config.correctAllJobs) {
      const notConfigJobs = allJobs.filter((job) => {
        return configJobs.find((configJob) => configJob.name === job.name) === undefined
      })
      const buildRespones = notConfigJobs.map((job) => {
        return {
          jobName: job.name,
          resultPromise: this.client!.fetchLastBuild(job.name)
            .then((res) => success(res))
            .catch((error) => failure(error))
        }
      })

      const stallDays = this.config.correctAllJobs.filterLastBuildDay ?? 30
      const now = Date.now()
      const thresholdTimestamp = now - stallDays * 24 * 60 * 60 * 1000

      for (const { jobName, resultPromise } of buildRespones) {
        const result = await resultPromise
        if (result.isFailure()) {
          console.debug(`(JenkinsRunner) Skip ${jobName}: can not fetch lastBuild.`)
          continue
        }

        if (result.isSuccess() && result.value && result.value.timestamp >= thresholdTimestamp) {
          otherJobs.push({
            name: jobName,
            testGlob: [],
            customReports: []
          })
        }
      }
    }

    return [...configJobs, ...otherJobs]
  }
}
