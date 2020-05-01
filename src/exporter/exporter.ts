import { LocalExporter } from "./local_exporter";
import { WorkflowReport } from "../analyzer/analyzer";
import { ExporterConfig } from "../config/config";

export interface Exporter {
  exportReports(reports: WorkflowReport[]): Promise<void>
}

export class CompositExporter {
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
    for (const exporter of this.exporters) {
      if (!exporter) continue

      await exporter.exportReports(reports)
    }
  }
}