/* eslint-disable */

export const protobufPackage = "schema";

export interface PbTestReport {
  /** 0 | 1 */
  successCount: number;
  /** 'SUCCESS' | 'FAILURE' */
  status: string;
  branch: string;
  workflowName: string;
  createdAt: Date | undefined;
  buildNumber: number;
  testSuites: PbTestSuites | undefined;
  service: string;
  workflowRunId: string;
  workflowId: string;
}

export interface PbTestSuites {
  testsuite: PbTestSuite[];
  failures: number;
  time: number;
  tests: number;
  name: string;
  errors: number;
  disabled: number;
}

export interface PbTestSuite {
  testcase: PbTestCase[];
  tests: number;
  time: number;
  timestamp: Date | undefined;
  skipped: number;
  failures: number;
  errors: number;
  name: string;
  disabled: number;
  hostname: string;
  id: string;
  package: string;
}

export interface PbTestCase {
  /** 'SUCCESS' | 'FAILURE' | 'ERROR' | 'SKIPPED' */
  status: string;
  /** 0 | 1 */
  successCount: number;
  time: number;
  name: string;
  classname: string;
  assertions: number;
}
