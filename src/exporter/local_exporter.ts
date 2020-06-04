import path from "path"
import fs from "fs"
import dayjs from 'dayjs'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"

type Format = 'json' | 'json_lines'
const defaultOutDir = 'output'

export class LocalExporter implements Exporter {
  service: string
  outDir: string
  formatter: (report: unknown[]) => string
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

  private exportReports(type: string, reports: unknown[]) {
    fs.mkdirSync(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-${type}-${this.service}.json`)

    const formated = this.formatter(reports)
    fs.writeFileSync(outputPath, formated, { encoding: 'utf8' })

    console.info(`(Local) Export ${type} reports to ${outputPath}`)
  }

  async exportWorkflowReports (reports: WorkflowReport[]) {
    this.exportReports('workflow', reports)
  }

  async exportTestReports (reports: TestReport[]) {
    this.exportReports('test', reports)
  }

  formatJson (reports: unknown[]): string {
    return JSON.stringify(reports, null, 2)
  }

  formatJsonLines (reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }

}