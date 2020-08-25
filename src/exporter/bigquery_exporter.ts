import os from "os"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { BigQuery } from '@google-cloud/bigquery'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"
import { BigqueryExporterConfig } from "../config/config"
import { CustomReportCollection } from "../custom_report_collection"

const schemaPaths = {
  workflow: path.join(__dirname, '..', '..', 'bigquery_schema/workflow_report.json'),
  test_report: path.join(__dirname, '..', '..', 'bigquery_schema/test_report.json'),
}

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

  private formatJsonLines (reports: unknown[]): string {
    return reports.map((report) => JSON.stringify(report)).join("\n")
  }

  private async export (reports: unknown[], table: string, schemaPathStr: string) {
    // Write report as tmp json file
    const randString = crypto.randomBytes(8).toString('hex')
    const tmpJsonPath = path.resolve(os.tmpdir(), `ci_analyzer_${randString}.json`)
    const reportJson = this.formatJsonLines(reports)
    await fs.promises.writeFile(tmpJsonPath, reportJson)

    // Load WorkflowReport table schema
    const schemaPath = path.resolve(schemaPathStr)
    const schemaFile = await fs.promises.readFile(schemaPath)
    const schema = JSON.parse(schemaFile.toString())

    // Load to BigQuery
    console.info(`(BigQuery) Loading ${tmpJsonPath} to ${this.dataset}.${table}. tmp file will be deleted if load complete with no error.`)
    try {
      await this.bigquery
        .dataset(this.dataset)
        .table(table)
        .load(tmpJsonPath, {
          schema: { fields: schema },
          maxBadRecords: this.maxBadRecords,
          schemaUpdateOptions: ['ALLOW_FIELD_ADDITION'],
          sourceFormat: 'NEWLINE_DELIMITED_JSON',
          writeDisposition: 'WRITE_APPEND',
        })
    } catch (error) {
      console.error(`(BigQuery) ERROR!! loading ${tmpJsonPath} to ${this.dataset}.${table}`)
      throw error
    }

    await fs.promises.unlink(tmpJsonPath)
  }

  async exportWorkflowReports (reports: WorkflowReport[]) {
    await this.export(reports, this.table.workflow, schemaPaths['workflow'])
  }

  async exportTestReports (reports: TestReport[]) {
    await this.export(reports, this.table.testReport, schemaPaths['test_report'])
  }

  async exportCustomReports (customReportCollection: CustomReportCollection) {
  }
}
