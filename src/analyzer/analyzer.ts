import { round } from "lodash-es";
import { type TestSuites, parse } from "junit2json";
import { z } from "zod";
import type { Artifact } from "../client/artifact.ts";

export type Status = "SUCCESS" | "FAILURE" | "ABORTED" | "OTHER";
const statusSchema = z.enum(["SUCCESS", "FAILURE", "ABORTED", "OTHER"]);
const successCountSchema = z.union([z.literal(0), z.literal(1)]);
const testStatusSchema = z.enum(["SUCCESS", "FAILURE"]);
const testCaseStatusSchema = z.enum(["SUCCESS", "FAILURE", "ERROR", "SKIPPED"]);

const stepReportSchema = z.object({
  name: z.string(),
  status: statusSchema,
  number: z.number(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  stepDurationSec: z.number(),
});

const jobReportSchema = z.object({
  workflowRunId: z.string(),
  buildNumber: z.number().optional(),
  jobId: z.string(),
  jobName: z.string(),
  status: statusSchema,
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  jobDurationSec: z.number(),
  sumStepsDurationSec: z.number(),
  steps: z.array(stepReportSchema),
  url: z.string(),
  executorClass: z.string(),
  executorType: z.string(),
  executorName: z.string(),
  queuedDurationSec: z.number(),
});

const jobParameterSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const workflowReportSchema = z.object({
  service: z.string(),
  workflowId: z.string(),
  workflowRunId: z.string(),
  buildNumber: z.number(),
  workflowName: z.string(),
  createdAt: z.date().optional(),
  trigger: z.string(),
  status: statusSchema,
  repository: z.string(),
  headSha: z.string(),
  branch: z.string(),
  tag: z.string(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  workflowDurationSec: z.number(),
  sumJobsDurationSec: z.number(),
  queuedDurationSec: z.number(),
  successCount: successCountSchema,
  jobs: z.array(jobReportSchema),
  parameters: z.array(jobParameterSchema),
  commitMessage: z.string(),
  actor: z.string(),
  url: z.string(),
});
export type WorkflowReport = z.infer<typeof workflowReportSchema>;

const workflowParamsSchema = z.object({
  workflowId: z.string(),
  workflowRunId: z.string(),
  buildNumber: z.number(),
  workflowName: z.string(),
});
export type WorkflowParams = z.infer<typeof workflowParamsSchema>;

type TestStatus = z.infer<typeof testStatusSchema>;
type TestCaseStatus = z.infer<typeof testCaseStatusSchema>;

const rawReportTestCaseSchema = z.object({
  time: z.number().optional(),
  name: z.string().optional(),
  classname: z.string().optional(),
  assertions: z.number().optional(),
  failure: z.unknown().optional(),
  error: z.unknown().optional(),
  skipped: z.unknown().optional(),
});

const reportTestCaseSchema = rawReportTestCaseSchema.transform(
  ({ failure, error, skipped, ...testCase }) => ({
    ...testCase,
    successCount: calcSuccessCount(failure || error || skipped),
    status: calcTestCaseStatus(failure, error, skipped),
  }),
);

const rawReportTestSuiteSchema = z.object({
  testcase: z.array(rawReportTestCaseSchema).optional().default([]),
  tests: z.number().optional(),
  time: z.number().optional(),
  timestamp: z.coerce.date().optional(),
  skipped: z.number().optional(),
  failures: z.number().optional(),
  errors: z.number().optional(),
  name: z.string().optional(),
  disabled: z.number().optional(),
  hostname: z.string().optional(),
  id: z.string().optional(),
  package: z.string().optional(),
});

const reportTestSuiteSchema = rawReportTestSuiteSchema.transform(
  ({ testcase, ...testSuite }) => ({
    ...testSuite,
    testcase: testcase.map((rawTestCase) =>
      reportTestCaseSchema.parse(rawTestCase),
    ),
  }),
);

const rawReportTestSuitesSchema = z.object({
  testsuite: z.array(rawReportTestSuiteSchema).optional().default([]),
  failures: z.number().optional(),
  time: z.number().optional(),
  tests: z.number().optional(),
  name: z.string().optional(),
  errors: z.number().optional(),
  disabled: z.number().optional(),
});

const reportTestSuitesSchema = rawReportTestSuitesSchema.transform(
  ({ testsuite, ...testSuites }) => ({
    ...testSuites,
    testsuite: testsuite.map((rawTestSuite) =>
      reportTestSuiteSchema.parse(rawTestSuite),
    ),
  }),
);
export type ReportTestSuites = z.infer<typeof reportTestSuitesSchema>;

const testReportSchema = z.object({
  workflowId: z.string(),
  workflowRunId: z.string(),
  buildNumber: z.number(),
  workflowName: z.string(),
  createdAt: z.date(),
  branch: z.string(),
  service: z.string(),
  testSuites: reportTestSuitesSchema,
  status: testStatusSchema,
  successCount: successCountSchema,
});
export type TestReport = z.infer<typeof testReportSchema>;

export interface Analyzer {
  createWorkflowParams(...args: unknown[]): WorkflowParams;
  createWorkflowReport(...args: unknown[]): WorkflowReport;
  createTestReports(...args: unknown[]): Promise<TestReport[]>;
}

const calcSuccessCount = (
  hasProblem: unknown,
): z.infer<typeof successCountSchema> => {
  return hasProblem ? 0 : 1;
};

const calcTestCaseStatus = (
  failure: unknown,
  error: unknown,
  skipped: unknown,
): TestCaseStatus => {
  if (failure) return "FAILURE";
  if (error) return "ERROR";
  if (skipped) return "SKIPPED";
  return "SUCCESS";
};

const calcTestStatus = (failures: number | undefined): TestStatus => {
  return failures && failures > 0 ? "FAILURE" : "SUCCESS";
};

export const diffSec = (start: string | Date, end: string | Date): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);

  return (endDate.getTime() - startDate.getTime()) / 1000;
};

export const secRound = (sec: number) => {
  const PRECISION = 3;
  return round(sec, PRECISION);
};

export const convertToReportTestSuites = (
  testSuites: TestSuites,
): ReportTestSuites => {
  return reportTestSuitesSchema.parse(testSuites);
};

export const convertToTestReports = async (
  workflowReport: WorkflowReport,
  junitArtifacts: Artifact[],
): Promise<TestReport[]> => {
  const testReports: TestReport[] = [];
  for (const artifact of junitArtifacts) {
    const xmlString = Buffer.from(artifact.data).toString("utf8");
    try {
      const result = await parse(xmlString);
      if (!result) continue;

      const testSuites =
        "testsuite" in result
          ? result
          : {
              // Fill in testsuites property with testsuit values.
              testsuite: [result],
              name: workflowReport.workflowId,
              time: result.time,
              tests: result.tests,
              failures: result.failures,
              errors: result.errors,
            };
      const createdAt = z.date().parse(workflowReport.createdAt);
      const status = calcTestStatus(testSuites.failures);

      testReports.push(
        testReportSchema.parse({
          workflowId: workflowReport.workflowId,
          workflowRunId: workflowReport.workflowRunId,
          buildNumber: workflowReport.buildNumber,
          workflowName: workflowReport.workflowName,
          createdAt,
          branch: workflowReport.branch,
          service: workflowReport.service,
          testSuites: convertToReportTestSuites(testSuites),
          status,
          successCount: calcSuccessCount(
            testSuites.failures && testSuites.failures > 0,
          ),
        }),
      );
    } catch (error) {
      console.error(
        `Error: Could not parse as JUnit XML. workflowRunId: ${workflowReport.workflowRunId}, path: ${artifact.path}`,
      );
      console.error(error);
    }
  }
  return testReports;
};
