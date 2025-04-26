import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Logger } from "tslog";
import dayjs from "dayjs";
import type { Exporter } from "./exporter.js";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.js";
import type { S3ExporterConfig } from "../config/schema.js";
import type {
  CustomReport,
  CustomReportCollection,
} from "../custom_report_collection.js";

export class S3Exporter implements Exporter {
  service: string;
  s3Client: S3Client;
  bucketName: string;
  prefixTemplate: string;
  logger: Logger<unknown>;

  constructor(
    logger: Logger<unknown>,
    service: string,
    config: S3ExporterConfig,
  ) {
    if (!config.region || !config.bucket || !config.prefixTemplate) {
      throw new Error(
        "Must need 'region', 'bucket', and 'prefixTemplate' parameters in exporter.s3 config.",
      );
    }
    if (!config.prefixTemplate.includes("{reportType}")) {
      throw new Error(
        "prefixTemplate must include '{reportType}' placeholder.",
      );
    }
    this.service = service;
    this.logger = logger.getSubLogger({ name: S3Exporter.name });
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials
        ? {
            accessKeyId: config.credentials.accessKeyId,
            secretAccessKey: config.credentials.secretAccessKey,
          }
        : undefined,
    });
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
        const createdAt = dayjs(report.createdAt);
        return this.prefixTemplate
          .replace("{reportType}", reportType)
          .replace("{YYYY}", createdAt.format("YYYY"))
          .replace("{MM}", createdAt.format("MM"))
          .replace("{DD}", createdAt.format("DD"));
      },
    );

    const now = dayjs();
    for (const [dirPath, reports] of Object.entries(groupedReports)) {
      const filePath = path.join(
        dirPath,
        `${now.format("YYYYMMDD-HHmmss")}-${reportType}-${this.service}.json`,
      );
      const reportJson = this.formatJsonLines(reports || []);

      this.logger.info(
        `Uploading ${reportType} reports to s3://${this.bucketName}/${filePath}`,
      );

      // S3へのアップロード
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
        Body: reportJson,
        ContentType: "application/json",
      });

      await this.s3Client.send(command);

      this.logger.info(
        `Successfully uploaded to s3://${this.bucketName}/${filePath}`,
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
