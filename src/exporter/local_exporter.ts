import path from "node:path";
import fs from "node:fs";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.ts";
import type { Exporter } from "./exporter.ts";
import type { LocalExporterConfig } from "../config/schema.ts";
import type {
  CustomReport,
  CustomReportCollection,
} from "../custom_report_collection.ts";
import type { Logger } from "tslog";
import { formatTimestamp } from "../date.ts";

const defaultOutDir = "output";

export class LocalExporter implements Exporter {
  service: string;
  outDir: string;
  formatter: (report: unknown[]) => string;
  fsPromises = fs.promises;
  logger: Logger<unknown>;

  constructor(
    logger: Logger<unknown>,
    service: string,
    configDir: string,
    config: LocalExporterConfig,
  ) {
    this.service = service;
    const _outDir = config.outDir ?? defaultOutDir;
    this.outDir = path.isAbsolute(_outDir)
      ? _outDir
      : path.resolve(configDir, _outDir);
    const format = config?.format ?? "json";
    this.formatter = format === "json" ? this.formatJson : this.formatJsonLines;
    this.logger = logger.getSubLogger({ name: LocalExporter.name });
  }

  private async export(
    reportType: string,
    reports: WorkflowReport[] | TestReport[] | CustomReport[],
  ) {
    await this.fsPromises.mkdir(this.outDir, { recursive: true });

    const now = new Date();
    const outputPath = path.join(
      this.outDir,
      `${formatTimestamp(now)}-${reportType}-${this.service}.json`,
    );

    const formated = this.formatter(reports);
    await this.fsPromises.writeFile(outputPath, formated, { encoding: "utf8" });

    this.logger.info(`Export ${reportType} reports to ${outputPath}`);
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

  formatJson(reports: unknown[]): string {
    return JSON.stringify(reports, null, 2);
  }

  formatJsonLines(reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n");
  }
}
