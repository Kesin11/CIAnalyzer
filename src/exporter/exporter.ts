import { LocalExporter } from "./local_exporter.ts";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.ts";
import type {
  ExporterConfig,
  LocalExporterConfig,
  BigqueryExporterConfig,
  GcsExporterConfig,
} from "../config/schema.ts";
import { BigqueryExporter } from "./bigquery_exporter.ts";
import type { CustomReportCollection } from "../custom_report_collection.ts";
import type { ArgumentOptions } from "../arg_options.ts";
import type { Logger } from "tslog";
import { GcsExporter } from "./gcs_exporter.ts";

export interface Exporter {
  exportWorkflowReports(reports: WorkflowReport[]): Promise<void>;
  exportTestReports(reports: TestReport[]): Promise<void>;
  exportCustomReports(
    customReportCollection: CustomReportCollection,
  ): Promise<void>;
}

export class CompositExporter implements Exporter {
  exporters: Exporter[];
  constructor(
    logger: Logger<unknown>,
    options: ArgumentOptions,
    service: string,
    config?: ExporterConfig,
  ) {
    if ((options.debug && options.onlyExporters === undefined) || !config) {
      this.exporters = [
        new LocalExporter(logger, service, options.configDir, {}),
      ];
      return;
    }

    const exporters = options.onlyExporters
      ? Object.keys(config).filter((exporter) =>
          options.onlyExporters?.includes(exporter),
        )
      : Object.keys(config);

    const resolvedExporters: Exporter[] = [];
    for (const exporter of exporters) {
      switch (exporter) {
        case "local": {
          const exporterConfig = (config[exporter] ??
            {}) as LocalExporterConfig;
          resolvedExporters.push(
            new LocalExporter(
              logger,
              service,
              options.configDir,
              exporterConfig,
            ),
          );
          break;
        }
        case "bigquery": {
          const exporterConfig = (config[exporter] ??
            {}) as BigqueryExporterConfig;
          resolvedExporters.push(
            new BigqueryExporter(logger, exporterConfig, options.configDir),
          );
          break;
        }
        case "gcs": {
          const exporterConfig = (config[exporter] ?? {}) as GcsExporterConfig;
          resolvedExporters.push(
            new GcsExporter(logger, service, exporterConfig),
          );
          break;
        }
        default: {
          break;
        }
      }
    }

    this.exporters = resolvedExporters;
  }

  async exportWorkflowReports(reports: WorkflowReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter.exportWorkflowReports(reports)),
    );
  }

  async exportTestReports(reports: TestReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter.exportTestReports(reports)),
    );
  }

  async exportCustomReports(customReportCollection: CustomReportCollection) {
    await Promise.all(
      this.exporters.map((exporter) =>
        exporter.exportCustomReports(customReportCollection),
      ),
    );
  }
}
