import { max } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { CircleciConfig, parseConfig } from "../config/circleci_config"
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"
import { GithubClient } from "../client/github_client"
import { CustomReportCollection, createCustomReportCollection, aggregateCustomReportArtifacts } from "../custom_report_collection"
import { failure, Result, success } from "../result"
import { ArgumentOptions } from "../arg_options"
import { Logger } from "tslog"
import { CircleciClientV2, Pipeline } from "../client/circleci_client_v2"
import { CircleciAnalyzerV2 } from "../analyzer/circleci_analyzer_v2"

const META_VERSION = 2
export type CircleciV2LastRunMetadata = {
  version: number
}

export class CircleciRunnerV2 implements Runner {
  service: string = 'circleci'
  client: CircleciClientV2
  analyzer: CircleciAnalyzerV2
  config: CircleciConfig | undefined
  store?: LastRunStore<CircleciV2LastRunMetadata>
  githubClient: GithubClient
  logger: Logger

  constructor(logger: Logger, public yamlConfig: YamlConfig, public options: ArgumentOptions) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.logger = logger.getChildLogger({ name: CircleciRunnerV2.name, instanceName: this.service })
    this.client = new CircleciClientV2(CIRCLECI_TOKEN, this.logger, options, this.config?.baseUrl)
    this.analyzer = new CircleciAnalyzerV2()

    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.githubClient = new GithubClient(GITHUB_TOKEN, options, this.config?.vcsBaseUrl?.github)
  }

  async isHostAvailableVersion(): Promise<Result<unknown, Error>> {
    return this.client.isHostAvailableVersion()
  }

  private setRepoLastRun(reponame: string, pipelines: Pipeline[]) {
    const maxBuildNumber = max(pipelines.map((pipeline) => pipeline.number))
    if (maxBuildNumber) {
      this.store?.setLastRun(reponame, maxBuildNumber)
    }
  }

  async run (): Promise<Result<unknown, Error>> {
    let result: Result<unknown, Error> = success(this.service)
    if (!this.config) return failure(new Error('this.config must not be undefined'))
    this.store = await LastRunStore.init<CircleciV2LastRunMetadata>(this.logger, this.options, this.service, this.config.lastRunStore)

    const workflowReports: WorkflowReport[] = []
    const testReports: TestReport[] = []
    const customReportCollection = new CustomReportCollection()
    for (const repo of this.config.repos) {
      this.logger.info(`Fetching ${this.service} - ${repo.fullname} ...`)

      try {
        this.migrateLastRun(repo.fullname)
        const lastRunId = this.store.getLastRun(repo.fullname)
        const pipelines = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vcsType, lastRunId)

        for (const pipeline of pipelines) {
          const workflows = await this.client.fetchPipelineWorkflows(pipeline)
          const tests = await this.client.fetchWorkflowsTests(workflows)

          // Create report
          const pipelineWorkflowReports = workflows.map((workflow) => this.analyzer.createWorkflowReport(pipeline, workflow))
          const pipelineTestReports = await this.analyzer.createTestReports(pipelineWorkflowReports, tests)

          // Aggregate
          workflowReports.push(...pipelineWorkflowReports)
          testReports.push(...pipelineTestReports)

          // Custom Report
          for (const workflow of workflows) {
            const customReportArtifactsList = await this.client.fetchWorkflowCustomReports(workflow, repo.customReports)
            const customReportArtifacts = aggregateCustomReportArtifacts(customReportArtifactsList)

            const workflowReport = pipelineWorkflowReports.find((report) => workflow.name === report.workflowName )!
            const runCustomReportCollection = await createCustomReportCollection(workflowReport, customReportArtifacts)

            customReportCollection.aggregate(runCustomReportCollection)
          }
        }

        this.setRepoLastRun(repo.fullname, pipelines)
      }
      catch (error) {
        const errorMessage = `Some error raised in '${repo.fullname}', so it skipped.`
        this.logger.error(errorMessage)
        result = failure(new Error(errorMessage))
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

  migrateLastRun(repoFullname: string) {
    const metadata = this.store?.getMeta(repoFullname)
    if (metadata?.version === META_VERSION) return

    if (metadata === undefined || metadata.version < META_VERSION) {
        // v1 is used job.number as WorkflowRunId that is grater than pipeline.number
        // As a result, should reset lastRun number before execute when migrate v1 to v2.
        this.store?.resetLastRun(repoFullname)
        this.store?.setMeta(repoFullname, { version: META_VERSION })
    }
    else if (metadata.version > META_VERSION) {
      throw new Error(`${repoFullname} was executed with ${metadata.version} that is newer than ${CircleciRunnerV2.name}`)
    }
  }
}
