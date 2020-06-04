import { LocalExporter } from "./local_exporter";
import { WorkflowReport, TestReport } from "../analyzer/analyzer";
import { ExporterConfig } from "../config/config";
import { BigqueryExporter } from "./bigquery_exporter";

export interface Exporter {
  exportWorkflowReports(reports: WorkflowReport[]): Promise<void>
  exportTestReports(reports: TestReport[]): Promise<void>
}

export class CompositExporter implements Exporter {
  exporters: (Exporter | undefined)[]
  constructor(service: string, configDir: string, config?: ExporterConfig) {
    if (!config) {
      this.exporters = [ new LocalExporter(service, configDir) ]
      return
    }

    this.exporters = Object.entries(config).map(([exporter, options]) => {
      switch (exporter) {
        case 'local':
          return new LocalExporter(service, configDir, { outDir: options.outDir, format: options.format })
        case 'bigquery':
          return new BigqueryExporter(options.project, options.dataset, options.table, { maxBadRecords: options.maxBadRecords })
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
}