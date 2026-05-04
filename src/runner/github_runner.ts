import { groupBy, maxBy } from "lodash-es";
import type { Runner } from "./runner.ts";
import type { ValidatedYamlConfig } from "../config/config.ts";
import { GithubClient, type WorkflowItem } from "../client/github_client.ts";
import {
  GithubAnalyzer,
  type WorkflowRunsItem,
} from "../analyzer/github_analyzer.ts";
import { type GithubConfig, parseConfig } from "../config/github_config.ts";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.ts";
import { CompositExporter } from "../exporter/exporter.ts";
import { LastRunStore } from "../last_run_store.ts";
import {
  CustomReportCollection,
  createCustomReportCollection,
} from "../custom_report_collection.ts";
import { failure, type Result, success } from "../result.ts";
import type { ArgumentOptions } from "../arg_options.ts";
import type { Logger } from "tslog";

type GithubConfigRepo = GithubConfig["repos"][0];

export class GithubRunner implements Runner {
  service = "github";
  client: GithubClient;
  analyzer: GithubAnalyzer;
  config: GithubConfig | undefined;
  store?: LastRunStore;
  logger: Logger<unknown>;
  yamlConfig: ValidatedYamlConfig;
  options: ArgumentOptions;

  constructor(
    logger: Logger<unknown>,
    yamlConfig: ValidatedYamlConfig,
    options: ArgumentOptions,
  ) {
    this.yamlConfig = yamlConfig;
    this.options = options;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
    this.config = parseConfig(yamlConfig);
    this.logger = logger.getSubLogger({ name: `${GithubRunner.name}` });
    this.client = new GithubClient(GITHUB_TOKEN, options, this.config?.baseUrl);
    this.analyzer = new GithubAnalyzer();
  }

  private getLastRun(repo: GithubConfigRepo, workflow: WorkflowItem) {
    return this.store?.getLastRun(`${repo.fullname}-${workflow.name}`);
  }
  private setRepoLastRun(repo: GithubConfigRepo, reports: WorkflowReport[]) {
    const workflowNameToReports = groupBy(reports, "workflowName");
    for (const [workflowName, reports] of Object.entries(
      workflowNameToReports,
    )) {
      const lastRunReport = maxBy(reports, "buildNumber");
      if (lastRunReport) {
        this.store?.setLastRun(
          `${repo.fullname}-${workflowName}`,
          lastRunReport.buildNumber,
        );
      }
    }
  }

  async run(): Promise<Result<unknown, Error>> {
    let result: Result<unknown, Error> = success(this.service);
    if (!this.config)
      return failure(new Error("this.config must not be undefined"));
    this.store = await LastRunStore.init(
      this.logger,
      this.options,
      this.service,
      this.config.lastRunStore,
    );

    let workflowReports: WorkflowReport[] = [];
    let testReports: TestReport[] = [];
    const customReportCollection = new CustomReportCollection();
    for (const repo of this.config.repos) {
      this.logger.info(`Fetching ${this.service} - ${repo.fullname} ...`);
      const repoWorkflowReports: WorkflowReport[] = [];
      let repoTestReports: TestReport[] = [];
      let workflowRuns: WorkflowRunsItem[] = [];

      try {
        const tagMap = await this.client.fetchRepositoryTagMap(
          repo.owner,
          repo.repo,
        );
        // Fetch repository workflow runs
        const workflows = await this.client.fetchWorkflows(
          repo.owner,
          repo.repo,
        );
        for (const workflow of workflows) {
          const lastRunId = this.getLastRun(repo, workflow);
          const _workflowRuns = await this.client.fetchWorkflowRuns(
            repo.owner,
            repo.repo,
            workflow.id,
            lastRunId,
          );
          workflowRuns = workflowRuns.concat(_workflowRuns);
        }

        for (const workflowRun of workflowRuns) {
          // Fetch data
          const jobs = await this.client.fetchJobs(
            repo.owner,
            repo.repo,
            workflowRun.id,
          );
          const tests = await this.client.fetchTests(
            repo.owner,
            repo.repo,
            workflowRun.id,
            repo.testGlob,
          );
          const customReportArtifacts = await this.client.fetchCustomReports(
            repo.owner,
            repo.repo,
            workflowRun.id,
            repo.customReports,
          );

          // Create report
          const workflowReport = this.analyzer.createWorkflowReport(
            workflowRun.name!,
            workflowRun,
            jobs,
            tagMap,
          );
          const testReports = await this.analyzer.createTestReports(
            workflowReport,
            tests,
          );
          const runCustomReportCollection = await createCustomReportCollection(
            workflowReport,
            customReportArtifacts,
          );

          // Aggregate
          repoWorkflowReports.push(workflowReport);
          repoTestReports = repoTestReports.concat(testReports);
          customReportCollection.aggregate(runCustomReportCollection);
        }
      } catch (error) {
        const errorMessage = `Some error raised in '${repo.fullname}', so it skipped.`;
        this.logger.error(errorMessage);
        result = failure(new Error(errorMessage, { cause: error as Error }));

        if (this.options.forceSaveLastRun) {
          this.logger.warn(
            `Force saving last run for '${repo.fullname}' with --force-save-last-run option.`,
          );
          this.setRepoLastRun(repo, repoWorkflowReports);
        }
        continue;
      }
      this.setRepoLastRun(repo, repoWorkflowReports);
      workflowReports = workflowReports.concat(repoWorkflowReports);
      testReports = testReports.concat(repoTestReports);
    }

    this.logger.info(`Exporting ${this.service} workflow reports ...`);
    const exporter = new CompositExporter(
      this.logger,
      this.options,
      this.service,
      this.config.exporter,
    );
    await exporter.exportWorkflowReports(workflowReports);
    await exporter.exportTestReports(testReports);
    await exporter.exportCustomReports(customReportCollection);

    this.store.save();
    this.logger.info(`Done execute '${this.service}'. status: ${result.type}`);

    return result;
  }
}
