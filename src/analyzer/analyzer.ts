import { round } from "lodash"

export type Status = 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'OTHER'

export type WorkflowReport = {
  service: string
  workflowId: string
  workflowRunId: string
  buildNumber: number
  workflowName: string
  createdAt: Date
  trigger: string
  status: Status
  repository: string
  headSha: string
  branch: string
  tag: string
  jobs: JobReport[]
  startedAt: Date
  completedAt: Date
  workflowDurationSec: number
  sumJobsDurationSec: number
  successCount: 0 | 1 // = 'SUCCESS': 1, others: 0. For create average success rate in dashboard
  parameters: JobParameter[]
}

export type JobReport = {
  workflowRunId: string
  buildNumber?: number
  jobId: string
  jobName: string
  status: Status
  startedAt: Date
  completedAt: Date
  jobDurationSec: number
  sumStepsDurationSec: number
  steps: StepReport[]
}

export type StepReport = {
  name: string
  status: Status
  number: number
  startedAt: Date
  completedAt: Date
  stepDurationSec: number
}

type JobParameter = {
  name: string
  value: string
}

export interface Analyzer {
  createWorkflowReport(...args: any[]): WorkflowReport
}

export const diffSec = (start: string | Date, end: string | Date): number => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  return (endDate.getTime() - startDate.getTime()) / 1000
}

export const secRound = (sec: number) => {
  const PRECISION = 3
  return round(sec, PRECISION)
}
