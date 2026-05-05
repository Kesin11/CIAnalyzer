import path from "node:path";
import { Storage } from "@google-cloud/storage";
import type { Logger } from "tslog";
import type { Exporter } from "./exporter.ts";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.ts";
import type { GcsExporterConfig } from "../config/schema.ts";
import type {
  CustomReport,
  CustomReportCollection,
} from "../custom_report_collection.ts";
import { formatDateTemplate, formatTimestamp } from "../date.ts";

export class GcsExporter implements Exporter {
  service: string;
  storage: Storage;
  bucketName: string;
  prefixTemplate: string;
  logger: Logger<unknown>;

  constructor(
    logger: Logger<unknown>,
    service: string,
    config: GcsExporterConfig,
  ) {
    if (!config.project || !config.bucket || !config.prefixTemplate) {
      throw new Error(
        "Must need 'project', 'bucket', and 'prefixTemplate' parameters in exporter.gcs config.",
      );
    }
    if (!config.prefixTemplate.includes("{reportType}")) {
      throw new Error(
        "prefixTemplate must include '{reportType}' placeholder.",
      );
    }
    this.service = service;
    this.logger = logger.getSubLogger({ name: GcsExporter.name });
    this.storage = new Storage({ projectId: config.project });
    this.bucketName = config.bucket;
    this.prefixTemplate = config.prefixTemplate;
  }

  private formatJsonLines(reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n");
  }

  private async export(
    reportType: string,
    reports: WorkflowReport[] | TestReport[] | CustomReport[],
  ) {
    const groupedReports = Object.groupBy(
      reports,
      (report: WorkflowReport | TestReport | CustomReport) => {
        return formatDateTemplate(
          this.prefixTemplate.replace("{reportType}", reportType),
          report.createdAt ?? new Date(),
        );
      },
    );

    const now = new Date();
    for (const [dirPath, reports] of Object.entries(groupedReports)) {
      const filePath = path.join(
        dirPath,
        `${formatTimestamp(now, { includeSeconds: true })}-${reportType}-${this.service}.json`,
      );
      const file = this.storage.bucket(this.bucketName).file(filePath);
      const reportJson = this.formatJsonLines(reports || []);

      this.logger.info(
        `Uploading ${reportType} reports to gs://${this.bucketName}/${filePath}`,
      );

      await file.save(reportJson);

      this.logger.info(
        `Successfully uploaded to gs://${this.bucketName}/${filePath}`,
      );
    }
  }

  async exportWorkflowReports(reports: WorkflowReport[]) {
    await this.export("workflow", reports);
  }

  async exportTestReports(reports: TestReport[]) {
    await this.export("test", reports);
  }

  async exportCustomReports(customReportCollection: CustomReportCollection) {
    for (const [name, reports] of customReportCollection.customReports) {
      await this.export(name, reports);
    }
  }
}
