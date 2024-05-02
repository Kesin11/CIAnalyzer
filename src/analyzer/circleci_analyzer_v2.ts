import { URL } from "node:url";
import { sumBy, sortBy, first } from "lodash-es";
import {
  type Status,
  diffSec,
  type Analyzer,
  secRound,
  type TestReport,
  type WorkflowParams,
  convertToReportTestSuites,
} from "./analyzer.js";
import type { JobTest } from "../client/circleci_client_v2.js";
import type { TestSuite, TestCase } from "junit2json";
import type { Pipeline, Workflow } from "../client/circleci_client_v2.js";
import type { CircleciStatus } from "../client/circleci_client.js";

type WorkflowReport = {
  service: "circleci";
  workflowId: string; // = ${repository}-${workflowName}
  workflowRunId: string; // = ${repository}-${workflowName}-${buildNumber}
  buildNumber: number; // pipeline.number
  workflowName: string;
  createdAt: Date; // = workflow.created_at
  trigger: string; // = pipeline.trigger.type
  status: Status;
  repository: string;
  headSha: string; // = pipeline.vcs.revision
  branch: string;
  tag: string; // = pipeline.trigger.type
  jobs: JobReport[];
  startedAt: Date; // = min(jobs start_time)
  completedAt: Date; // = workflow.stopped_at
  workflowDurationSec: number; // = completedAt - startedAt
  sumJobsDurationSec: number; // = sum(jobs sumStepsDurationSec)
  successCount: 0 | 1; // = 'SUCCESS': 1, others: 0
  parameters: []; // CircleciAnalyzerV2 does not support output build parameters yet
  queuedDurationSec: number; // createdAt - startedAt
  commitMessage: string;
  actor: string; // Kesin11
  url: ""; // CircleCI does not provide Pipeline html url
};

type JobReport = {
  workflowRunId: string; // = workflowRunId
  buildNumber: number; // = job.job_number
  jobId: string; // = job.id
  jobName: string; // = job.name
  status: Status;
  startedAt: Date; // job.started_at
  completedAt: Date; // job.stopped_at
  jobDurationSec: number; // = completedAt - startedAt
  sumStepsDurationSec: number; // = sum(steps duration)
  steps: StepReport[];
  url: string; // https://app.circleci.com/pipelines/{vcs}/{org}/{repo}/{pipelineNumber}/workflows/{workflowId}
  executorClass: string; // medium
  executorType: string; // docker
  executorName: ""; // CircleCI does not support self-hosted runner
};

type StepReport = {
  name: string;
  status: Status;
  number: number;
  startedAt: Date;
  completedAt: Date;
  stepDurationSec: number; // run_time_millis
};

export class CircleciAnalyzerV2 implements Analyzer {
  htmlBaseUrl: string;
  constructor(baseUrl?: string) {
    // Remove pathname: '/api/' and add subdomain: 'app.'
    const url = new URL(baseUrl ?? "https://circleci.com");
    url.hostname = `app.${url.hostname}`;
    this.htmlBaseUrl = url.origin;
  }

  createWorkflowParams(
    workflowName: string,
    repository: string,
    buildNumber: number,
  ): WorkflowParams {
    return {
      workflowName,
      buildNumber,
      workflowId: `${repository}-${workflowName}`,
      workflowRunId: `${repository}-${workflowName}-${buildNumber}`,
    };
  }

  createWorkflowReport(pipeline: Pipeline, workflow: Workflow): WorkflowReport {
    const repository = workflow.project_slug.split("/").slice(1).join("/");
    const { workflowName, workflowId, buildNumber, workflowRunId } =
      this.createWorkflowParams(workflow.name, repository, pipeline.number);

    const jobReports: JobReport[] = workflow.jobs.map((job) => {
      const stepReports: StepReport[] = job.steps
        .filter((step) => {
          const action = first(step.actions)!;
          // NOTE: Ignore background step (ex. Setup service container image step)
          return action.background === false;
        })
        .map((step) => {
          const action = first(step.actions)!;
          const startedAt = new Date(action.start_time);
          // NOTE: Sometimes action.end_time will be broken, so it should be replaced when it's value is invalid.
          const validatedEndTime = action.end_time ?? action.start_time;
          const completedAt = new Date(validatedEndTime);
          // step
          return {
            name: action.name,
            status: this.normalizeStatus(action.status),
            number: action.step,
            startedAt,
            completedAt,
            stepDurationSec: diffSec(startedAt, completedAt),
          };
        });

      const startedAt = new Date(job.started_at);
      const completedAt = new Date(job.stopped_at ?? job.started_at);
      const url = new URL(
        `pipelines/${workflow.project_slug}/${workflow.pipeline_number}/workflows/${workflow.id}`,
        this.htmlBaseUrl,
      );
      // job
      return {
        workflowRunId,
        buildNumber: job.job_number,
        jobId: job.id,
        jobName: job.name,
        status: this.normalizeStatus(job.status as CircleciStatus),
        startedAt,
        completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec: secRound(sumBy(stepReports, "stepDurationSec")),
        steps: stepReports,
        url: url.toString(),
        executorClass: job.detail.executor.resource_class,
        executorType: job.detail.executor.type,
        executorName: "",
      };
    });

    const sortedJobs = sortBy(workflow.jobs, "job_number");
    const firstJob = first(sortedJobs);
    const createdAt = new Date(workflow.created_at);
    // Sometimes worklfow has invalid timestamps, so remediate it.
    const startedAt = new Date(firstJob?.started_at ?? workflow.created_at);
    const completedAt = new Date(workflow.stopped_at ?? startedAt);
    const status = this.normalizeWorkflowStatus(workflow.status);
    // workflow
    return {
      service: "circleci",
      workflowId,
      buildNumber,
      workflowRunId,
      workflowName,
      createdAt,
      trigger: pipeline.trigger.type,
      status,
      repository,
      headSha: pipeline.vcs.revision,
      branch: pipeline.vcs.branch ?? "",
      tag: pipeline.vcs.tag ?? "",
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: secRound(sumBy(jobReports, "sumStepsDurationSec")),
      successCount: status === "SUCCESS" ? 1 : 0,
      parameters: [],
      queuedDurationSec: diffSec(createdAt, startedAt), // firstJob.started_at - workflow.created_at
      commitMessage: pipeline.vcs.commit?.subject ?? "",
      actor: pipeline.trigger.actor.login,
      url: "",
    };
  }

  private normalizeStatus(status: CircleciStatus): Status {
    switch (status) {
      case "success":
        return "SUCCESS";
      case "fixed":
        return "SUCCESS";
      case "failed":
        return "FAILURE";
      case "canceled":
        return "ABORTED";
      case "timedout":
        return "ABORTED";
      default:
        return "OTHER";
    }
  }

  private normalizeWorkflowStatus(status: Workflow["status"]): Status {
    switch (status) {
      case "success":
        return "SUCCESS";
      case "failed":
        return "FAILURE";
      case "failing":
        return "FAILURE";
      case "error":
        return "FAILURE";
      case "canceled":
        return "ABORTED";
      default:
        return "OTHER";
    }
  }

  async createTestReports(
    workflowReports: WorkflowReport[],
    tests: JobTest[],
  ): Promise<TestReport[]> {
    const testReports: TestReport[] = [];
    for (const workflowReport of workflowReports) {
      // Filter tests that related to workflow jobs
      const jobAndJobTests = workflowReport.jobs.map((job) => {
        return {
          job,
          jobTest: tests.find((test) => test.jobNumber === job.buildNumber),
        };
      });
      const testSuiteList: TestSuite[] = jobAndJobTests
        .filter(({ jobTest }) => jobTest && jobTest.tests.length > 0)
        .map(({ job, jobTest }) => {
          // TestCases = CircleCI tests
          const testCases: TestCase[] = jobTest!.tests.map((test) => {
            return {
              classname: test.classname,
              name: test.name,
              time: test.run_time,
              failure:
                test.result === "failure"
                  ? [{ inner: test.message ?? "" }]
                  : undefined,
              skipped:
                test.result === "skipped"
                  ? [{ message: test.message ?? "" }]
                  : undefined,
            };
          });
          // TestSuite = CircleCI Job
          return {
            name: job.jobName,
            time: secRound(sumBy(testCases, "time")),
            tests: testCases.length,
            failures: testCases.filter(
              (testcase) => testcase.failure !== undefined,
            ).length,
            skipped: testCases.filter(
              (testcase) => testcase.skipped !== undefined,
            ).length,
            timestamp: job.startedAt.toISOString(),
            testcase: testCases,
          };
        });

      if (testSuiteList.length === 0) continue;

      // TestSuiets = CircleCI Workflow
      const testSuites = {
        name: workflowReport.workflowName,
        time: secRound(sumBy(testSuiteList, "time")),
        tests: sumBy(testSuiteList, "tests"),
        failures: sumBy(testSuiteList, "failures"),
        testsuite: testSuiteList,
      };
      testReports.push({
        workflowId: workflowReport.workflowId,
        workflowRunId: workflowReport.workflowRunId,
        buildNumber: workflowReport.buildNumber,
        workflowName: workflowReport.workflowName,
        createdAt: workflowReport.createdAt,
        branch: workflowReport.branch,
        service: workflowReport.service,
        testSuites: convertToReportTestSuites(testSuites),
        status: testSuites.failures > 0 ? "FAILURE" : "SUCCESS",
        successCount: testSuites.failures > 0 ? 0 : 1,
      });
    }
    return testReports;
  }
}
