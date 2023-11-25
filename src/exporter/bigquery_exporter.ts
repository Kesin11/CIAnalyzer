import os from "os"
import path from "path"
import fs from "fs"
import crypto from "crypto"
import { BigQuery } from '@google-cloud/bigquery'
import { WorkflowReport, TestReport } from "../analyzer/analyzer"
import { Exporter } from "./exporter"
import { BigqueryExporterConfig } from "../config/schema"
import { CustomReportCollection } from "../custom_report_collection"
import { Logger } from "tslog"
import { BQ_SCHEMA_PATHS } from "../constant"

export class BigqueryExporter implements Exporter {
  bigquery: BigQuery
  dataset: string
  table: {
    workflow: string
    testReport: string
  }
  customReportTableInfo: Map<string, { table: string, schemaPath: string }>
  maxBadRecords: number
  logger: Logger<unknown>

  constructor( logger: Logger<unknown>, config: BigqueryExporterConfig, configDir: string ) {
    if (!config.project || !config.dataset) {
      throw new Error("Must need 'project', 'dataset' parameter in exporter.bigquery config.")
    }
    this.logger = logger.getSubLogger({ name: BigqueryExporter.name })
    this.bigquery = new BigQuery({ projectId: config.project })
    this.dataset = config.dataset

    const workflowTable = config.reports?.find((report) => report.name === 'workflow')?.table
    const testReportTable = config.reports?.find((report) => report.name === 'test_report')?.table
    if (!workflowTable || !testReportTable) {
      throw new Error("Must need both 'workflow' and 'test_report' table name in exporter.bigquery.reports config.")
    }
    this.table = {
      workflow: workflowTable,
      testReport: testReportTable,
    }

    this.customReportTableInfo = new Map(
      config.customReports?.map((customReport) => {
        const schemaPath = (path.isAbsolute(customReport.schema))
          ? customReport.schema
          : path.resolve(configDir, customReport.schema)
        return [
          customReport.name,
          { table: customReport.table, schemaPath }
        ]
      })
    )

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
    this.logger.info(`Loading ${tmpJsonPath} to ${this.dataset}.${table}. tmp file will be deleted if load complete with no error.`)
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
      this.logger.error(`ERROR!! loading ${tmpJsonPath} to ${this.dataset}.${table}`)
      throw error
    }

    await fs.promises.unlink(tmpJsonPath)
  }

  async exportWorkflowReports (reports: WorkflowReport[]) {
    await this.export(reports, this.table.workflow, BQ_SCHEMA_PATHS['workflow'])
  }

  async exportTestReports (reports: TestReport[]) {
    await this.export(reports, this.table.testReport, BQ_SCHEMA_PATHS['test_report'])
  }

  async exportCustomReports (customReportCollection: CustomReportCollection) {
    for (const [reportName, customReports] of customReportCollection.customReports) {
      const table = this.customReportTableInfo.get(reportName)
      if (table === undefined) throw new Error(`name: '${reportName}' does not exists in exporter.bigquery.customReports config!!`)

      await this.export(customReports, table.table, table.schemaPath)
    }
  }
}
