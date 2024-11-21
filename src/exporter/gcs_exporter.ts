import { Storage } from "@google-cloud/storage";
import { Exporter } from "./exporter.js";
import { WorkflowReport, TestReport } from "../analyzer/analyzer.js";
import { GcsExporterConfig } from "../config/schema.js";
import { CustomReportCollection } from "../custom_report_collection.js";
import { Logger } from "tslog";
import dayjs from "dayjs";

export class GcsExporter implements Exporter {
  storage: Storage;
  bucketName: string;
  pathTemplate: string;
  logger: Logger<unknown>;

  constructor(logger: Logger<unknown>, config: GcsExporterConfig) {
    if (!config.project || !config.bucket || !config.pathTemplate) {
      throw new Error(
        "Must need 'project', 'bucket', and 'pathTemplate' parameters in exporter.gcs config."
      );
    }
    if (!config.pathTemplate.includes("{reportType}")) {
      throw new Error(
        "pathTemplate must include '{reportType}' placeholder."
      );
    }
    this.logger = logger.getSubLogger({ name: GcsExporter.name });
    this.storage = new Storage({ projectId: config.project });
    this.bucketName = config.bucket;
    this.pathTemplate = config.pathTemplate;
  }

  private formatJsonLines(reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n");
  }

  private async export(reports: unknown[], reportType: string) {
    const now = dayjs();
    const filePath = this.pathTemplate
      .replace("gs://", "")
      .replace("{reportType}", reportType)
      .replace("{YYYY}", now.format("YYYY"))
      .replace("{MM}", now.format("MM"))
      .replace("{DD}", now.format("DD"))
      .replace("{hh}", now.format("HH"))
      .replace("{mm}", now.format("mm"))
      .replace("{ss}", now.format("ss"));

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filePath);
    const reportJson = this.formatJsonLines(reports);

    this.logger.info(
      `Uploading ${reportType} reports to gs://${this.bucketName}/${filePath}`
    );

    await file.save(reportJson, {
      contentType: "application/json",
    });

    this.logger.info(`Successfully uploaded to gs://${this.bucketName}/${filePath}`);
  }

  async exportWorkflowReports(reports: WorkflowReport[]) {
    await this.export(reports, "workflow");
  }

  async exportTestReports(reports: TestReport[]) {
    await this.export(reports, "test");
  }

  async exportCustomReports(customReportCollection: CustomReportCollection) {
    for (const [name, reports] of customReportCollection.customReports) {
      await this.export(reports, name);
    }
  }
}
