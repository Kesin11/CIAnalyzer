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

  async exportWorkflowReports (reports: WorkflowReport[]) {
    fs.mkdirSync(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-${this.service}.json`)

    const formated = this.formatter(reports)
    fs.writeFileSync(outputPath, formated, { encoding: 'utf8' })

    console.info(`(Local) Export reports to ${outputPath}`)
  }

  formatJson (reports: unknown[]): string {
    return JSON.stringify(reports, null, 2)
  }

  formatJsonLines (reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }

  async exportTestReports (reports: TestReport[]) {
    fs.mkdirSync(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-test-${this.service}.json`)

    const formated = this.formatter(reports)
    fs.writeFileSync(outputPath, formated, { encoding: 'utf8' })

    console.info(`(Local) Export test reports to ${outputPath}`)
  }
}