import path from "path"
import fs from "fs"
import dayjs from 'dayjs'
import { WorkflowReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"

type Format = 'json' | 'json_lines'
const defaultOutDir = 'output'

export class LocalExporter implements Exporter {
  service: string
  outDir: string
  formatter: (report: WorkflowReport[]) => string
  constructor(
    service: string,
    configDir: string,
    options?: { outDir?: string, format?: Format }
  ) {
    this.service = service
    const _outDir = options?.outDir ?? defaultOutDir
    this.outDir = (path.isAbsolute(_outDir))
      ? _outDir
      : path.resolve(configDir, _outDir)
    const format = options?.format ?? 'json'
    this.formatter = (format === 'json') ? this.formatJson : this.formatJsonLines
  }

  async exportReports (reports: WorkflowReport[]) {
    fs.mkdirSync(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-${this.service}.json`)

    const formated = this.formatter(reports)
    fs.writeFileSync(outputPath, formated, { encoding: 'utf8' })

    console.info(`(Local) Export reports to ${outputPath}`)
  }

  formatJson (reports: WorkflowReport[]): string {
    return JSON.stringify(reports, null, 2)
  }

  formatJsonLines (reports: WorkflowReport[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }
}