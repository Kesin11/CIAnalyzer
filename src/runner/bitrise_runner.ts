import { maxBy } from "lodash"
import { TestReport, WorkflowReport } from "../analyzer/analyzer"
import { BitriseAnalyzer } from "../analyzer/bitrise_analyzer"
import { ArgumentOptions } from "../arg_options"
import { BitriseClient } from "../client/bitrise_client"
import { BitriseConfig, parseConfig } from "../config/bitrise_config"
import { YamlConfig } from "../config/config"
import { createCustomReportCollection, CustomReportCollection } from "../custom_report_collection"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"
import { Result, success, failure } from "../result"
import { Runner } from "./runner"

export class BitriseRunner implements Runner {
  service: string = 'bitrise'
  client: BitriseClient
  analyzer: BitriseAnalyzer
  config: BitriseConfig | undefined
  store?: LastRunStore
  constructor(public yamlConfig: YamlConfig, public options: ArgumentOptions) {
    const BITRISE_TOKEN = process.env['BITRISE_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new BitriseClient(BITRISE_TOKEN, options)
    this.analyzer = new BitriseAnalyzer()
  }

  private setRepoLastRun(appSlug: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store?.setLastRun(appSlug, lastRunReport.buildNumber)
    }
  }

  async run (): Promise<Result<unknown, Error>> {
    let result: Result<unknown, Error> = success(this.service)
    if (!this.config) return failure(new Error('this.config must not be undefined'))
    this.store = await LastRunStore.init(this.options, this.service, this.config.lastRunStore)

    let workflowReports: WorkflowReport[] = []
    let testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()

    const allApps = await this.client.fetchApps()
    const appConfigApps = this.config.apps.map((configApp) => {
      // NOTE: Bitrise can register duplicate apps that has same owner/title
      // But it is not common case, so use first matched app simply.
      const app = allApps.find((app) => app.fullname === configApp.fullname)
      return { app, configApp }
    })

    for (const { app, configApp } of appConfigApps) {
      if (!app) continue
      console.info(`Fetching ${this.service} - ${configApp.fullname} ...`)
      const appReports: WorkflowReport[] = []
      let appTestReports: TestReport[] = []

      try {
        const lastRunId = this.store.getLastRun(app.slug)
        const builds = await this.client.fetchBuilds(app.slug, lastRunId)

        for (const build of builds) {
          // Fetch data
          const buildLog = await this.client.fetchJobLog(app.slug, build.slug)
          const tests = await this.client.fetchTests(app.slug, build.slug, configApp.testGlob)
          const customReportArtifacts = await this.client.fetchCustomReports(app.slug, build.slug, configApp.customReports)

          // Create report
          const workflowReport = this.analyzer.createWorkflowReport(app, build, buildLog)
          const testReports = await this.analyzer.createTestReports(workflowReport, tests)
          const runCustomReportCollection = await createCustomReportCollection(workflowReport, customReportArtifacts)

          // Aggregate
          appReports.push(workflowReport)
          appTestReports = appTestReports.concat(testReports)
          customReportCollection.aggregate(runCustomReportCollection)
        }
      }
      catch (error) {
        const errorMessage = `Some error raised in '${configApp.fullname}', so it skipped.`
        console.error(errorMessage)
        console.error(error)
        result = failure(new Error(errorMessage))
        continue
      }
      this.setRepoLastRun(app.slug, appReports)
      workflowReports = workflowReports.concat(appReports)
      testReports = testReports.concat(appTestReports)
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.options, this.service, this.config.exporter)
    await exporter.exportWorkflowReports(workflowReports)
    await exporter.exportTestReports(testReports)
    await exporter.exportCustomReports(customReportCollection)

    this.store.save()
    console.info(`Done execute '${this.service}'. status: ${result.type}`)

    return result
  }
}
