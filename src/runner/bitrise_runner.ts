import { maxBy } from "lodash-es";
import type { Logger } from "tslog";
import type { TestReport, WorkflowReport } from "../analyzer/analyzer.js";
import { BitriseAnalyzer } from "../analyzer/bitrise_analyzer.js";
import type { ArgumentOptions } from "../arg_options.js";
import { BitriseClient } from "../client/bitrise_client.js";
import { type BitriseConfig, parseConfig } from "../config/bitrise_config.js";
import type { ValidatedYamlConfig } from "../config/config.js";
import {
  createCustomReportCollection,
  CustomReportCollection,
} from "../custom_report_collection.js";
import { CompositExporter } from "../exporter/exporter.js";
import { LastRunStore } from "../last_run_store.js";
import { type Result, success, failure } from "../result.js";
import type { Runner } from "./runner.js";

export class BitriseRunner implements Runner {
  service = "bitrise";
  client: BitriseClient;
  analyzer: BitriseAnalyzer;
  config: BitriseConfig | undefined;
  store?: LastRunStore;
  logger: Logger<unknown>;

  constructor(
    logger: Logger<unknown>,
    public yamlConfig: ValidatedYamlConfig,
    public options: ArgumentOptions,
  ) {
    const BITRISE_TOKEN = process.env.BITRISE_TOKEN || "";
    this.config = parseConfig(yamlConfig);
    this.logger = logger.getSubLogger({ name: `${BitriseRunner.name}` });
    this.client = new BitriseClient(BITRISE_TOKEN, this.logger, options);
    this.analyzer = new BitriseAnalyzer();
  }

  private setRepoLastRun(appSlug: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, "buildNumber");
    if (lastRunReport) {
      this.store?.setLastRun(appSlug, lastRunReport.buildNumber);
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

    const allApps = await this.client.fetchApps();
    const appConfigApps = this.config.apps.map((configApp) => {
      // NOTE: Bitrise can register duplicate apps that has same owner/title
      // But it is not common case, so use first matched app simply.
      const app = allApps.find((app) => app.fullname === configApp.fullname);
      return { app, configApp };
    });

    for (const { app, configApp } of appConfigApps) {
      if (!app) continue;
      this.logger.info(`Fetching ${this.service} - ${configApp.fullname} ...`);
      const appReports: WorkflowReport[] = [];
      let appTestReports: TestReport[] = [];

      try {
        const lastRunId = this.store.getLastRun(app.slug);
        const builds = await this.client.fetchBuilds(app.slug, lastRunId);

        for (const build of builds) {
          // Fetch data
          const buildLog = await this.client.fetchJobLog(app.slug, build.slug);
          const tests = await this.client.fetchTests(
            app.slug,
            build.slug,
            configApp.testGlob,
          );
          const customReportArtifacts = await this.client.fetchCustomReports(
            app.slug,
            build.slug,
            configApp.customReports,
          );

          // Create report
          const workflowReport = this.analyzer.createWorkflowReport(
            app,
            build,
            buildLog,
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
          appReports.push(workflowReport);
          appTestReports = appTestReports.concat(testReports);
          customReportCollection.aggregate(runCustomReportCollection);
        }
      } catch (error) {
        const errorMessage = `Some error raised in '${configApp.fullname}', so it skipped.`;
        this.logger.error(errorMessage);
        result = failure(new Error(errorMessage, { cause: error as Error }));

        if (this.options.forceSaveLastRun) {
          this.logger.warn(
            `Force saving last run for '${configApp.fullname}' with --force-save-last-run option.`,
          );
          this.setRepoLastRun(app.slug, appReports);
        }
        continue;
      }
      this.setRepoLastRun(app.slug, appReports);
      workflowReports = workflowReports.concat(appReports);
      testReports = testReports.concat(appTestReports);
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
