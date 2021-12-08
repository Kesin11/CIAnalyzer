import { sumBy, min, max, sortBy, first, last } from "lodash"
import { Status, diffSec, Analyzer, secRound, TestReport, WorkflowParams, convertToReportTestSuites } from "./analyzer"
import { WorkflowRun, SingleBuildResponse, CircleciStatus, TestResponse } from "../client/circleci_client"
import { RepositoryTagMap } from "../client/github_client"
import { TestSuite, TestCase } from "junit2json"

type WorkflowReport = {
  // workflow
  service: 'circleci',
  workflowId: string, // = ${repository}-${workflowName}
  workflowRunId: string, // = ${repository}-${workflowName}-${buildNumber}
  buildNumber: number, // last(jobs.buildNumber): CircleCI does not provide workflow number
  workflowName: string,
  createdAt: Date, // = min(jobs queued_at)
  trigger: string // = why
  status: Status,
  repository: string,
  headSha: string, // = vcs_revision
  branch: string,
  tag: string, // Detect from Github API response
  jobs: JobReport[],
  startedAt: Date, // = min(jobs start_time)
  completedAt: Date // = max(jobs stop_time)
  workflowDurationSec: number // = completedAt - startedAt
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
  successCount: 0 | 1 // = 'SUCCESS': 1, others: 0
  parameters: [] // CircleciAnalyzer does not support output build parameters yet
  queuedDurationSec: number // createdAt - min(jobs start_time)
  commitMessage: '' // CircleCIAnalyzer(v1) does not support
  actor: '' // CircleCIAnalyzer(v1) does not support
  url: '' // CircleCIAnalyzer(v1) does not support
}

export type JobReport = {
  workflowRunId: string, // = workflowRunId
  buildNumber: number, // = build_number
  jobId: string, // = workflows.job_id
  jobName: string, // workflows.job_name
  status: Status,
  startedAt: Date, // start_time
  completedAt: Date, // stop_time
  jobDurationSec: number, // = completedAt - startedAt
  sumStepsDurationSec: number // = sum(steps duration)
  steps: StepReport[],
  url: '' // CircleCIAnalyzer(v1) does not support
  executorClass: '' // CircleCIAnalyzer(v1) does not support
  executorType: '' // CircleCIAnalyzer(v1) does not support
  executorName: '' // CircleCIAnalyzer(v1) does not support
}

type StepReport = {
  name: string,
  status: Status,
  number: number,
  startedAt: Date,
  completedAt: Date,
  stepDurationSec: number // run_time_millis
}

export class CircleciAnalyzer implements Analyzer {
  constructor() { }

  createWorkflowParams(workflowName: string, repository: string, buildNumber: number): WorkflowParams {
    return {
      workflowName,
      buildNumber,
      workflowId: `${repository}-${workflowName}`,
      workflowRunId: `${repository}-${workflowName}-${buildNumber}`
    }
  }

  createWorkflowReport( workflowRun: WorkflowRun, jobs: SingleBuildResponse[], tagMap: RepositoryTagMap): WorkflowReport {
    const sortedJobs = sortBy(jobs, 'build_num')
    const firstJob = first(sortedJobs)!
    const lastJob = last(sortedJobs)!
    const repository = `${firstJob.username}/${firstJob.reponame}`
    const { workflowName, workflowId, buildNumber, workflowRunId }
      = this.createWorkflowParams(workflowRun.workflow_name, repository, lastJob.build_num)

    const jobReports: JobReport[] = sortedJobs.map((job) => {
      const stepReports: StepReport[] = job.steps
        .filter((step) => {
          const action = first(step.actions)!
          // NOTE: Ignore background step (ex. Setup service container image step)
          return action.background === false
        })
        .map((step) => {
          const action = first(step.actions)!
          const startedAt = new Date(action.start_time)
          // NOTE: Sometimes action.end_time will be broken, so it should be replaced when it's value is invalid.
          const validatedEndTime = action.end_time ?? action.start_time
          const completedAt = new Date(validatedEndTime)
          // step
          return {
            name: action.name,
            status: this.normalizeStatus(action.status),
            number: action.step,
            startedAt,
            completedAt,
            stepDurationSec: diffSec(startedAt, completedAt)
          }
        })

      const startedAt = new Date(job.start_time)
      const completedAt = new Date(job.stop_time)
      // job
      return {
        workflowRunId,
        buildNumber: job.build_num,
        jobId: job.workflows.job_id,
        jobName: job.workflows.job_name,
        status: this.normalizeStatus(job.status),
        startedAt,
        completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec: secRound(sumBy(stepReports, 'stepDurationSec')),
        steps: stepReports,
        url: '',
        executorClass: '',
        executorType: '',
        executorName: '',
      }
    })

    const startedAt = min(jobReports.map((job) => job.startedAt ))!
    const completedAt = max(jobReports.map((job) => job.completedAt ))!
    const status = this.estimateWorkflowStatus(jobReports)
    const createdAt = min(jobs.map((job) => new Date(job.queued_at)))!
    // workflow
    return {
      service: 'circleci',
      workflowId,
      buildNumber,
      workflowRunId,
      workflowName,
      createdAt,
      trigger: firstJob.why,
      status,
      repository,
      headSha: firstJob.vcs_revision,
      branch: firstJob.branch,
      tag: tagMap.get(firstJob.vcs_revision) ?? '',
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: secRound(sumBy(jobReports, 'sumStepsDurationSec')),
      successCount: (status === 'SUCCESS') ? 1 : 0,
      parameters: [],
      queuedDurationSec: diffSec(createdAt, min(jobs.map((job) => new Date(job.start_time)))!),
      commitMessage: '',
      actor: '',
      url: '',
    }
  }

  normalizeStatus(status: CircleciStatus): Status {
    switch (status) {
      case 'success':
        return 'SUCCESS'
      case 'fixed':
        return 'SUCCESS'
      case 'failed':
        return 'FAILURE'
      case 'canceled':
        return 'ABORTED'
      case 'timedout':
        return 'ABORTED'
      default:
        return 'OTHER';
    }
  }

  estimateWorkflowStatus(jobs: JobReport[]): Status {
    const statuses = jobs.map((job) => job.status)

    if ( statuses.some((status) => status === 'ABORTED' )) return 'ABORTED'
    else if ( statuses.some((status) => status === 'FAILURE' )) return 'FAILURE'
    else if ( statuses.some((status) => status === 'SUCCESS' )) return 'SUCCESS'
    else return 'OTHER'
  }

  async createTestReports( workflowReport: WorkflowReport, jobs: SingleBuildResponse[], tests: TestResponse[]): Promise<TestReport[]> {
    const testSuiteList: TestSuite[] = tests
      .filter((test) => test.tests.length > 0)
      .map((test) => {
        const testCases: TestCase[] = test.tests.map((test) => {
          return {
            classname: test.classname,
            name: test.name,
            time: test.run_time,
            failure: (test.result === 'failure') ? [{ inner: test.message }] : undefined,
            skipped: (test.result === 'skipped') ? [{ message: test.message }] : undefined,
          }
        })
        const testJob = jobs.find((job) => job.build_num === test.run_id)
        return {
          name: testJob?.workflows.job_name ?? '',
          time: secRound(sumBy(testCases, 'time')),
          tests: testCases.length,
          failures: testCases.filter((testcase) => testcase.failure !== undefined).length,
          skipped: testCases.filter((testcase) => testcase.skipped !== undefined).length,
          timestamp: testJob?.start_time,
          testcase: testCases,
        }
      })

    if (testSuiteList.length === 0 ) return []

    const testSuites = {
      name: workflowReport.workflowName,
      time: secRound(sumBy(testSuiteList, 'time')),
      tests: sumBy(testSuiteList, 'tests'),
      failures: sumBy(testSuiteList, 'failures'),
      testsuite: testSuiteList,
    }
    return [{
      workflowId: workflowReport.workflowId,
      workflowRunId: workflowReport.workflowRunId,
      buildNumber: workflowReport.buildNumber,
      workflowName: workflowReport.workflowName,
      createdAt: workflowReport.createdAt,
      branch: workflowReport.branch,
      service: workflowReport.service,
      testSuites: convertToReportTestSuites(testSuites),
      status: (testSuites.failures > 0) ? 'FAILURE' : 'SUCCESS',
      successCount: (testSuites.failures > 0) ? 0 : 1,
    }]
  }
}
