import { round } from "lodash-es"
import { type TestSuites, type TestCase, type TestSuite, parse } from 'junit2json'
import type { Assign } from 'utility-types'
import type { Artifact } from "../client/client.js"
import type { PbWorkflowReport, PbWorkflowParams } from "../pb_types/workflow.js"
import type { PbTestReport, PbTestSuites, PbTestSuite, PbTestCase } from "../pb_types/test_report.js"

// Overwrite generated by protobuf types to more strict TypeScript types
export type Status = 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'OTHER'
export type WorkflowReport = Assign<PbWorkflowReport, {
  status: Status,
  successCount: 0 | 1
}>
export type WorkflowParams = PbWorkflowParams

// Overwrite generated by protobuf types to more strict TypeScript types
type TestStatus = 'SUCCESS' | 'FAILURE'
type TestCaseStatus = 'SUCCESS' | 'FAILURE' | 'ERROR' | 'SKIPPED'
export type TestReport = Assign<PbTestReport, {
  successCount: 0 | 1,
  status: TestStatus,
  createdAt: Date,
  testSuites: ReportTestSuites,
}>
export type ReportTestSuites = Assign<PbTestSuites,{
  testsuite: ReportTestSuite[],
}>
type ReportTestSuite = Assign<PbTestSuite, {
  testcase: ReportTestCase[],
  timestamp: Date,
}>
type ReportTestCase = Assign<PbTestCase, {
  successCount: 0 | 1,
  status: TestCaseStatus,
}>

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
  // Omit properties that may contain free and huge text data.
  // And add successCount, status
  filterd.testsuite
    .forEach((testSuite: TestSuite) => {
      delete testSuite["system-out"]
      delete testSuite["system-err"]
      delete testSuite.properties
      testSuite?.testcase?.forEach((testCase: TestCase) => {
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

export const convertToTestReports = async (workflowReport: WorkflowReport, junitArtifacts: Artifact[]): Promise<TestReport[]> => {
    const testReports: TestReport[] = []
    for (const artifact of junitArtifacts) {
      const xmlString = Buffer.from(artifact.data).toString('utf8')
      try {
        const result = await parse(xmlString)
        if (!result) continue

        const testSuites = ('testsuite' in result) ? result : {
          // Fill in testsuites property with testsuit values.
          testsuite: [result],
          name: workflowReport.workflowId,
          time: result.time,
          tests: result.tests,
          failures: result.failures,
          errors: result.errors,
        }

        testReports.push({
          workflowId: workflowReport.workflowId,
          workflowRunId: workflowReport.workflowRunId,
          buildNumber: workflowReport.buildNumber,
          workflowName: workflowReport.workflowName,
          createdAt: workflowReport.createdAt as Date, // NOTE: hack for types generated by protobuf
          branch: workflowReport.branch,
          service: workflowReport.service,
          testSuites: convertToReportTestSuites(testSuites),
          status: (testSuites.failures && testSuites.failures > 0) ? 'FAILURE' : 'SUCCESS',
          successCount: (testSuites.failures && testSuites.failures > 0) ? 0 : 1,
        })
      } catch (error) {
        console.error(`Error: Could not parse as JUnit XML. workflowRunId: ${workflowReport.workflowRunId}, path: ${artifact.path}`)
      }
    }
    return testReports
  }
