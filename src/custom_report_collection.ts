export type CustomReport = {
  workflowId: string
  workflowRunId: string
  createdAt: Date,
  [key: string]: unknown
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