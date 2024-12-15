import { LocalExporter } from "./local_exporter.js";
import type { WorkflowReport, TestReport } from "../analyzer/analyzer.js";
import type {
  ExporterConfig,
  LocalExporterConfig,
  BigqueryExporterConfig,
  GcsExporterConfig,
} from "../config/schema.js";
import { BigqueryExporter } from "./bigquery_exporter.js";
import type { CustomReportCollection } from "../custom_report_collection.js";
import type { ArgumentOptions } from "../arg_options.js";
import type { Logger } from "tslog";
import { GcsExporter } from "./gcs_exporter.js";

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
    if (options.debug || !config) {
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

    this.exporters = exporters
      .map((exporter) => {
        let _config:
          | LocalExporterConfig
          | BigqueryExporterConfig
          | GcsExporterConfig;
        switch (exporter) {
          case "local":
            _config = config[exporter] ?? {};
            return new LocalExporter(
              logger,
              service,
              options.configDir,
              _config,
            );
          case "bigquery":
            _config = config[exporter] ?? {};
            return new BigqueryExporter(logger, _config, options.configDir);
          case "gcs":
            _config = config[exporter] ?? {};
            return new GcsExporter(
              logger,
              service,
              _config as GcsExporterConfig,
            );
        }
      })
      .filter((exporter) => exporter !== undefined);
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
