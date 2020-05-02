import { sumBy, min, max, sortBy, first, last } from "lodash"
import { Status, diffSec, Analyzer } from "./analyzer"
import { WorkflowRun, SingleBuildResponse, CircleciStatus } from "../client/circleci_client"

type WorkflowReport = {
  // workflow
  service: 'circleci',
  workflowId: string, // = workflow_id
  buildNumber?: number, // undefined. CircleCI dows not provide workflow number
  workflowName: string,
  createdAt: Date, // = min(jobs queued_at)
  trigger: string // = why
  status: Status,
  repository: string,
  headSha: string, // = vcs_revision
  branch: string,
  jobs: JobReport[],
  startedAt: Date, // = min(jobs start_time)
  completedAt: Date // = max(jobs stop_time)
  workflowDurationSec: number // = sum(job jobDurationSec)
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
}

type JobReport = {
  workflowId: string, // = workflow_id
  buildNumber?: number, // = build_number
  jobId: string, // = workflows.job_id
  jobName: string, // workflows.job_name
  status: Status,
  startedAt: Date, // start_time
  completedAt: Date, // stop_time
  jobDurationSec: number, // = build_time_millis
  sumStepsDurationSec: number // = sum(steps duration)
  steps: StepReport[],
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

  createWorkflowReport( workflowRun: WorkflowRun, jobs: SingleBuildResponse[]): WorkflowReport {
    const sortedJobs = sortBy(jobs, 'build_num')
    const firstJob = first(sortedJobs)!
    const lastJob = last(sortedJobs)!

    const jobReports: JobReport[] = sortedJobs.map((job) => {
      const stepReports: StepReport[] = job.steps.map((step) => {
        const action = first(step.actions)!
        const startedAt = new Date(action.start_time)
        const completedAt = new Date(action.end_time)
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
        workflowId: job.workflows.workflow_id,
        buildNumber: job.build_num,
        jobId: job.workflows.job_id,
        jobName: job.workflows.job_name,
        status: this.normalizeStatus(job.status),
        startedAt,
        completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec: sumBy(stepReports, 'stepDurationSec'),
        steps: stepReports,
      }
    })

    const startedAt = min(jobReports.map((job) => job.startedAt ))!
    const completedAt = max(jobReports.map((job) => job.completedAt ))!
    // workflow
    return {
      service: 'circleci',
      workflowId: workflowRun.workflow_id,
      buildNumber: undefined,
      workflowName: workflowRun.workflow_name,
      createdAt: min(jobs.map((job) => new Date(job.queued_at)))!,
      trigger: firstJob.why,
      status: this.normalizeStatus(lastJob.status),
      repository: firstJob.reponame,
      headSha: firstJob.vcs_revision,
      branch: firstJob.branch,
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: sumBy(jobReports, 'jobDurationSec'),
      sumJobsDurationSec: sumBy(jobReports, 'sumStepsDurationSec')
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
}