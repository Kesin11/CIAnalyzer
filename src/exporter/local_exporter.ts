import path from "path"
import fs from "fs"
import dayjs from 'dayjs'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"
import { LocalExporterConfig } from "../config/config"

const defaultOutDir = 'output'

export class LocalExporter implements Exporter {
  service: string
  outDir: string
  formatter: (report: unknown[]) => string
  fsPromises = fs.promises
  constructor(
    service: string,
    configDir: string,
    config: LocalExporterConfig,
  ) {
    this.service = service
    const _outDir = config.outDir ?? defaultOutDir
    this.outDir = (path.isAbsolute(_outDir))
      ? _outDir
      : path.resolve(configDir, _outDir)
    const format = config?.format ?? 'json'
    this.formatter = (format === 'json') ? this.formatJson : this.formatJsonLines
  }

  private async exportReports(type: string, reports: unknown[]) {
    await this.fsPromises.mkdir(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-${type}-${this.service}.json`)

    const formated = this.formatter(reports)
    await this.fsPromises.writeFile(outputPath, formated, { encoding: 'utf8' })

    console.info(`(Local) Export ${type} reports to ${outputPath}`)
  }

  async exportWorkflowReports (reports: WorkflowReport[]) {
    await this.exportReports('workflow', reports)
  }

  async exportTestReports (reports: TestReport[]) {
    await this.exportReports('test', reports)
  }

  formatJson (reports: unknown[]): string {
    return JSON.stringify(reports, null, 2)
  }

  formatJsonLines (reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }

}