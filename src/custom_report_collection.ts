import { WorkflowReport } from "./analyzer/analyzer.js"
import { CustomReportArtifact } from "./client/client.js"

export type CustomReport = {
  workflowId: string
  workflowRunId: string
  createdAt: Date,
  [key: string]: unknown
}

export const aggregateCustomReportArtifacts = (customReportArtifactsList: CustomReportArtifact[]) => {
  const aggregated: CustomReportArtifact = new Map()
  for (const customReportArtifacts of customReportArtifactsList) {
    for (const [name, artifacts] of customReportArtifacts) {
      const aggregatedArtifacts = aggregated.get(name)
      if (aggregatedArtifacts) {
        aggregated.set(name, aggregatedArtifacts.concat(artifacts))
      } else {
        aggregated.set(name, artifacts)
      }
    }
  }
  return aggregated
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
        console.error(`Error: Could not parse as JSON. workflowRunId: ${workflowReport.workflowRunId}, path: ${artifact.path}`)
        return
      }

      return {
        workflowId: workflowReport.workflowId,
        workflowRunId: workflowReport.workflowRunId,
        createdAt: workflowReport.createdAt,
        ...data
      } as CustomReport
    }).filter((report): report is CustomReport => report !== undefined)

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