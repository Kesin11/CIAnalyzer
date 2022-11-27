import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/validator"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { JenkinsClient } from "../client/jenkins_client"
import { JenkinsAnalyzer } from "../analyzer/jenkins_analyzer"
import { JenkinsConfig, parseConfig } from "../config/jenkins_config"
import { LastRunStore } from "../last_run_store"
import { CustomReportCollection, createCustomReportCollection } from "../custom_report_collection"
import { failure, Result, success } from "../result"
import { ArgumentOptions } from "../arg_options"
import { Logger } from "tslog"

export class JenkinsRunner implements Runner {
  service: string = 'jenkins'
  client?: JenkinsClient
  analyzer?: JenkinsAnalyzer
  config?: JenkinsConfig
  store?: LastRunStore
  logger: Logger

  constructor(logger: Logger, public yamlConfig: YamlConfig, public options: ArgumentOptions) {
    this.config = parseConfig(yamlConfig)
    this.logger = logger.getChildLogger({ name: JenkinsRunner.name, instanceName: this.service })

    if (!this.config) return
    const JENKINS_USER = process.env['JENKINS_USER']
    const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
    this.analyzer = new JenkinsAnalyzer(this.config.baseUrl)
    this.client = new JenkinsClient(this.config.baseUrl, this.logger, options, JENKINS_USER, JENKINS_TOKEN)
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
    if (!this.analyzer) return failure(new Error('this.analyzer must not be undefined'))
    this.store = await LastRunStore.init(this.logger, this.options, this.service, this.config.lastRunStore)

    const jobs = await this.getJobs()

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const job of jobs) {
      this.logger.info(`Fetching ${this.service} - ${job.name} ...`)
      const jobReports: WorkflowReport[] = []
      let jobTestReports: TestReport[] = []

      try {
        const lastRunId = this.store.getLastRun(job.name)
        const runs = await this.client.fetchJobRuns(job.name, lastRunId)

        if (runs.length < 1) {
          this.logger.warn(`SKIP ${job.name}: it does not have any runs data for some reason`)
          continue
        }

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
        this.logger.error(errorMessage)
        result = failure(new Error(errorMessage, { cause: error as Error }))
        continue
      }
    }

    this.logger.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.logger, this.options, this.service, this.config.exporter)
    await exporter.exportWorkflowReports(workflowReports)
    await exporter.exportTestReports(testReports)
    await exporter.exportCustomReports(customReportCollection)

    this.store.save()
    this.logger.info(`Done execute '${this.service}'. status: ${result.type}`)

    return result
  }

  private async getJobs(): Promise<JenkinsConfig["jobs"]> {
    if (!this.config) return []
    if (!this.client) return []

    const allJobs = await this.client.fetchJobs(this.config.correctAllJobs?.isRecursively ?? false)
    const allJobMap = new Map(allJobs.map((job) => [job.name, job]))
    const configJobs = this.config.jobs.filter((job) => allJobMap.get(job.name))

    const otherJobs: JenkinsConfig["jobs"] = []
    if (this.config.correctAllJobs) {
      const notConfigJobs = allJobs.filter((job) => {
        return configJobs.find((configJob) => configJob.name === job.name) === undefined
      })
      const buildRespones = notConfigJobs.map((job) => {
        return {
          jobName: job.name,
          resultPromise: this.client!.fetchLastBuild(job.name)
            .then((res) => success(res))
            .catch((error) => Promise.resolve(failure(error)))
        }
      })

      const stallDays = this.config.correctAllJobs.filterLastBuildDay ?? 30
      const now = Date.now()
      const thresholdTimestamp = now - stallDays * 24 * 60 * 60 * 1000

      for (const { jobName, resultPromise } of buildRespones) {
        const result = await resultPromise
        if (result.isFailure()) {
          this.logger.warn(`SKIP ${jobName}: Can not fetch lastBuild number.`)
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
