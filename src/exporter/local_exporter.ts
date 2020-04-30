import path from "path"
import fs from "fs"
import dayjs from 'dayjs'
import { WorkflowReport } from "../analyzer/analyzer"

type Format = 'json' | 'row_based_json'
const defaultOutDir = path.join(__dirname, '../../output')

export class LocalExporter {
  service: string
  outDir: string
  formatter: (report: WorkflowReport[]) => string
  constructor(service: string, outDir?: string, format?: Format) {
    this.service = service
    this.outDir = outDir ?? defaultOutDir
    format = format ?? 'json'
    this.formatter = (format === 'json') ? this.formatJson : this.formatRowBasedJson
  }

  exportReports (reports: WorkflowReport[]) {
    fs.mkdirSync(this.outDir, { recursive: true })

    const now = dayjs()
    const outputPath = path.join(this.outDir, `${now.format('YYYYMMDD-HHmm')}-${this.service}.json`)

    const formated = this.formatter(reports)
    fs.writeFileSync(outputPath, formated, { encoding: 'utf8' })
  }

  formatJson (reports: WorkflowReport[]): string {
    return JSON.stringify(reports, null, 2)
  }

  formatRowBasedJson (reports: WorkflowReport[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }
}