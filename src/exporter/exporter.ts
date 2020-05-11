import { LocalExporter } from "./local_exporter";
import { WorkflowReport } from "../analyzer/analyzer";
import { ExporterConfig } from "../config/config";
import { BigqueryExporter } from "./bigquery_exporter";

export interface Exporter {
  exportReports(reports: WorkflowReport[]): Promise<void>
}

export class CompositExporter implements Exporter {
  exporters: (Exporter | undefined)[]
  constructor(service: string, config?: ExporterConfig) {
    if (!config) {
      this.exporters = [ new LocalExporter(service) ]
      return
    }

    this.exporters = Object.entries(config).map(([exporter, options]) => {
      switch (exporter) {
        case 'local':
          return new LocalExporter(service, options.outDir, options.format)
        case 'bigquery':
          return new BigqueryExporter(options.project, options.dataset, options.table, { maxBadRecords: options.maxBadRecords })
        default:
          return undefined
      }
    })
  }

  async exportReports(reports: WorkflowReport[]) {
    await Promise.all(
      this.exporters.map((exporter) => exporter?.exportReports(reports))
    )
  }
}