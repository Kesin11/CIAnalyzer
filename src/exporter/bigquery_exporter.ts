import os from "os"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { BigQuery } from '@google-cloud/bigquery'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"
import { BigqueryExporterConfig } from "../config/config"

export class BigqueryExporter implements Exporter {
  bigquery: BigQuery
  dataset: string
  table: {
    workflow: string
    testReport: string
  }
  maxBadRecords: number
  constructor( config: BigqueryExporterConfig ) {
    if (!config.project || !config.dataset) {
      throw "Must need 'project', 'dataset' parameter in exporter.bigquery config."
    }
    this.bigquery = new BigQuery({ projectId: config.project })
    this.dataset = config.dataset

    const workflowTable = config.reports?.find((report) => report.name === 'workflow')?.table
    const testReportTable = config.reports?.find((report) => report.name === 'test_report')?.table
    if (!workflowTable || !testReportTable) {
      throw "Must need both 'workflow' and 'test_report' table name in exporter.bigquery.reports config."
    }
    this.table = {
      workflow: workflowTable,
      testReport: testReportTable,
    }

    this.maxBadRecords = config.maxBadRecords ?? 0
  }

  async exportWorkflowReports (reports: WorkflowReport[]) {
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
      .table(this.table.workflow)
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