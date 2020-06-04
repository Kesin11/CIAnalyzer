import os from "os"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { BigQuery } from '@google-cloud/bigquery'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"

export class BigqueryExporter implements Exporter {
  bigquery: BigQuery
  dataset: string
  table: string
  maxBadRecords: number
  constructor(
    projectId?: string, dataset?: string, table?: string,
    options?: { maxBadRecords?: number }
  ) {
    if (!projectId || !dataset || !table) {
      throw "Must need 'project', 'dataset', 'table' params for BigQuery exporter"
    }
    this.bigquery = new BigQuery({ projectId })
    this.dataset = dataset
    this.table = table
    this.maxBadRecords = options?.maxBadRecords ?? 0
  }

  async exportReports (reports: WorkflowReport[]) {
    // Write report as tmp json file
    const randString = crypto.randomBytes(8).toString('hex')
    const tmpJsonPath = path.resolve(os.tmpdir(), `ci_analyzer_${randString}.json`)
    const reportJson = this.formatJsonLines(reports)
    await fs.promises.writeFile(tmpJsonPath, reportJson)

    // Load WorkflowReport table schema
    const schemaPath = path.resolve(__dirname, '..', '..', 'bigquery_schema/workflow_report.json')
    const schemaFile = await fs.promises.readFile(schemaPath)
    const schema = JSON.parse(schemaFile.toString())

    // Load to BigQuery
    const results = await this.bigquery
      .dataset(this.dataset)
      .table(this.table)
      .load(tmpJsonPath, {
        schema: { fields: schema }, 
        maxBadRecords: this.maxBadRecords,
        schemaUpdateOptions: ['ALLOW_FIELD_ADDITION'],
        sourceFormat: 'NEWLINE_DELIMITED_JSON',
        writeDisposition: 'WRITE_APPEND',
        timePartitioning: {
          type: 'DAY',
          field: 'createdAt',
        }
      })

    const job = results[0]
    const errors = job.status?.errors
    if (errors && errors.length > 0) {
      throw errors
    }

    console.info(`(BigQuery) Load ${tmpJsonPath} to ${this.dataset}.${this.table} completed. tmp file will be delete.`)

    await fs.promises.unlink(tmpJsonPath)
  }

  formatJsonLines (reports: WorkflowReport[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }

  async exportTestReports (reports: TestReport[]) { }
}