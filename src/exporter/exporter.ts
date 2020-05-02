import { LocalExporter } from "./local_exporter";
import { WorkflowReport } from "../analyzer/analyzer";
import { ExporterConfig } from "../config/config";

export interface Exporter {
  exportReports(reports: WorkflowReport[]): Promise<void>
}

export class CompositExporter implements Exporter {
  exporters: (Exporter | undefined)[]
  constructor(service: string, config: ExporterConfig) {
    this.exporters = Object.entries(config).map(([exporter, options]) => {
      switch (exporter) {
        case 'local':
          return new LocalExporter(service, options.outDir, options.format)
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