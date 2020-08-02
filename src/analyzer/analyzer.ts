import { round } from "lodash"
import { TestSuites, TestCase, TestSuite } from 'junit2json'
import { Overwrite, Assign } from 'utility-types'

export type Status = 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'OTHER'
export type TestStatus = 'SUCCESS' | 'FAILURE'
export type TestCaseStatus = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'SKIPPED'

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

export type TestReport = {
  workflowId: string
  workflowRunId: string
  buildNumber: number
  workflowName: string
  createdAt: Date,
  branch: string,
  service: string,
  testSuites: ReportTestSuites
  status: TestStatus // = testSuites.failures > 0: 'FAILURE', else: 'SUCCESS'
  successCount: 0 | 1 // = testSuites.failures > 0: 1, else: 1. For create average success rate in dashboard
}

// Omit properties that may contain free and huge text data.
export type ReportTestSuites = Overwrite<TestSuites, { testsuite: ReportTestSuite[] }>
export type ReportTestSuite = Overwrite<Omit<TestSuite, 'system-out' | 'system-err' | 'properties'>, { testcase: ReportTestCase[] }>
export type ReportTestCase = Assign<
  Omit<TestCase, 'error' | 'failure' | 'system-out' | 'system-err' | 'skipped'>
  ,{ successCount: 0 | 1, status: TestCaseStatus }
>

export type WorkflowParams = {
  workflowId: string
  workflowRunId: string
  buildNumber: number
  workflowName: string
}

export interface Analyzer {
  createWorkflowParams(...args: any[]): WorkflowParams
  createWorkflowReport(...args: any[]): WorkflowReport
  createTestReports(...args: any[]): Promise<TestReport[]>
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

export const convertToReportTestSuites = (testSuites: TestSuites): ReportTestSuites => {
  const filterd = JSON.parse(JSON.stringify(testSuites))
  filterd.testsuite
    .forEach((testSuite: TestSuite) => {
      delete testSuite["system-out"]
      delete testSuite["system-err"]
      delete testSuite.properties
      testSuite.testcase.forEach((testCase: TestCase) => {
        (testCase as any).successCount = (testCase.failure || testCase.error || testCase.skipped) ? 0 : 1;
        (testCase as any).status =
          testCase.failure ? 'FAILURE'
          : testCase.error ? 'ERROR'
          : testCase.skipped ? 'SKIPPED'
          : 'SUCCESS'
        delete testCase["system-out"]
        delete testCase["system-err"]
        delete testCase.failure
        delete testCase.error
        delete testCase.skipped
      })
    })
  return filterd
}
