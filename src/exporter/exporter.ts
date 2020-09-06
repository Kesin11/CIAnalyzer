import { LocalExporter } from "./local_exporter";
import { WorkflowReport, TestReport } from "../analyzer/analyzer";
import { ExporterConfig, LocalExporterConfig, BigqueryExporterConfig } from "../config/config";
import { BigqueryExporter } from "./bigquery_exporter";
import { CustomReportCollection } from "../custom_report_collection";

export interface Exporter {
  exportWorkflowReports(reports: WorkflowReport[]): Promise<void>
  exportTestReports(reports: TestReport[]): Promise<void>
  exportCustomReports(customReportCollection: CustomReportCollection): Promise<void>
}

export class CompositExporter implements Exporter {
  exporters: (Exporter | undefined)[]
  constructor(service: string, configDir: string, config?: ExporterConfig) {
    if (!config) {
      this.exporters = [ new LocalExporter(service, configDir, {}) ]
      return
    }

    this.exporters = Object.keys(config).map((exporter) => {
      let _config: LocalExporterConfig | BigqueryExporterConfig
      switch (exporter) {
        case 'local':
          _config = config['local'] ?? {}
          return new LocalExporter(service, configDir, _config)
        case 'bigquery':
          _config = config['bigquery'] ?? {}
          return new BigqueryExporter(_config, configDir)
        default:
          return undefined
      }
    })
  }

  async exportWorkflowReports(reports: WorkflowReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter?.exportWorkflowReports(reports))
    )
  }

  async exportTestReports(reports: TestReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter?.exportTestReports(reports))
    )
  }

  async exportCustomReports(customReportCollection: CustomReportCollection) {
    await Promise.all(
      this.exporters.map((exporter) => exporter?.exportCustomReports(customReportCollection))
    )
  }
}