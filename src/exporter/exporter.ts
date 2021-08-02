import { LocalExporter } from "./local_exporter";
import { WorkflowReport, TestReport } from "../analyzer/analyzer";
import { ExporterConfig, LocalExporterConfig, BigqueryExporterConfig } from "../config/config";
import { BigqueryExporter } from "./bigquery_exporter";
import { CustomReportCollection } from "../custom_report_collection";
import { ArgumentOptions } from "../arg_options";
import { Logger } from "tslog";

export interface Exporter {
  exportWorkflowReports(reports: WorkflowReport[]): Promise<void>
  exportTestReports(reports: TestReport[]): Promise<void>
  exportCustomReports(customReportCollection: CustomReportCollection): Promise<void>
}

export class CompositExporter implements Exporter {
  exporters: Exporter[]
  constructor(logger: Logger, options: ArgumentOptions, service: string, config?: ExporterConfig) {
    if (options.debug || !config) {
      this.exporters = [ new LocalExporter(logger,service, options.configDir, {}) ]
      return
    }

    const exporters = options.onlyExporters
      ? Object.keys(config).filter((exporter) => options.onlyExporters?.includes(exporter))
      : Object.keys(config)

    this.exporters = exporters.map((exporter) => {
      let _config: LocalExporterConfig | BigqueryExporterConfig
      switch (exporter) {
        case 'local':
          _config = config[exporter] ?? {}
          return new LocalExporter(logger, service, options.configDir, _config)
        case 'bigquery':
          _config = config[exporter] ?? {}
          return new BigqueryExporter(logger, _config, options.configDir)
      }
    }).filter((exporter): exporter is NonNullable<typeof exporter> => exporter !== undefined)
  }

  async exportWorkflowReports(reports: WorkflowReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter.exportWorkflowReports(reports))
    )
  }

  async exportTestReports(reports: TestReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter.exportTestReports(reports))
    )
  }

  async exportCustomReports(customReportCollection: CustomReportCollection) {
    await Promise.all(
      this.exporters.map((exporter) => exporter.exportCustomReports(customReportCollection))
    )
  }
}