import { WorkflowReport } from "./analyzer/analyzer"
import { CustomReportArtifact } from "./client/client"

export type CustomReport = {
  workflowId: string
  workflowRunId: string
  createdAt: Date,
  [key: string]: unknown
}

export const createCustomReportCollection = async (workflowReport: WorkflowReport, customReportArtifacts: CustomReportArtifact): Promise<CustomReportCollection> => {
  const reportCollection = new CustomReportCollection()
  for (const [reportName, artifacts] of customReportArtifacts) {
    const reports = artifacts.map((artifact) => {
      let data: { [key: string]: unknown }
      try {
        const jsonString = Buffer.from(artifact.data).toString('utf8')
        data = JSON.parse(jsonString)
      } catch (error) {
        console.error(`Error: Could not parse as JSON. ${artifact.path}`)
        return
      }

      return {
        workflowId: workflowReport.workflowId,
        workflowRunId: workflowReport.workflowRunId,
        createdAt: workflowReport.createdAt,
        ...data
      } as CustomReport
    }).filter((report) => report !== undefined) as CustomReport[]

    reportCollection.set(reportName, reports)
  }
  return reportCollection
}

export class CustomReportCollection {
  customReports: Map<string, CustomReport[]> = new Map<string, CustomReport[]>()

  get (key: string) {
    return this.customReports.get(key)
  }

  set (key: string, reports: CustomReport[]) {
    return this.customReports.set(key, reports)
  }

  aggregate (another: CustomReportCollection): void {
    for (const [name, reports] of another.customReports) {
      const thisReports = this.get(name)
      if (thisReports) {
        this.set(name, thisReports.concat(reports))
      } else {
        this.set(name, reports)
      }
    }
  }
}