import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import _ from 'lodash'
export type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listRepoWorkflowRuns']['response']['data']['workflow_runs'][0]
export type JobsItem = RestEndpointMethodTypes['actions']['listJobsForWorkflowRun']['response']['data']['jobs']

export type Status = 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'OTHER'

export type WorkflowReport = {
  // workflow
  service: 'github',
  workflowId: string, // = id = job.run_id
  buildNumber?: number, // = run_number
  workflowName: string,
  createdAt: Date,
  trigger: string // = event
  status: Status,
  repository: string,
  headSha: string,
  branch: string,
  jobs: JobReport[],
  startedAt: Date, // = min(jobs startedAt)
  completedAt: Date // = max(jobs completedAt)
  workflowDurationSec: number // = completedAt - startedAt
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
}

export type JobReport = {
  workflowId: string, // = run_id
  buildNumber?: number, // undefined. Github Action does not provide job build number
  jobId: string, // = id
  jobName: string,
  status: Status,
  startedAt: Date,
  completedAt: Date,
  jobDurationSec: number, // = completedAt - startedAt
  sumStepsDurationSec: number // = sum(steps duration)
  steps: StepReport[],
}

export type StepReport = {
  name: string,
  status: Status,
  number: number,
  startedAt: Date,
  completedAt: Date,
  stepDurationSec: number // completedAt - startedAt
}

const diffSec = (start: string | Date, end: string | Date): number => {
  const startDate = new Date(start)
  const endDate = new Date(end)

  return (endDate.getTime() - startDate.getTime()) / 1000
}

export class GithubAnalyzer {
  constructor() { }

  createWorkflowReport(workflowName: string, workflow: WorkflowRunsItem, jobs: JobsItem): WorkflowReport {
    const buildNumber = workflow.run_number

    const jobReports: JobReport[] = jobs.map((job) => {
      const stepReports: StepReport[] = job.steps.map((step) => {
        const startedAt = new Date(step.started_at)
        const completedAt = new Date(step.completed_at)
        // step
        return {
          name: step.name,
          status: this.normalizeStatus(step.conclusion),
          number: step.number,
          startedAt,
          completedAt,
          stepDurationSec: diffSec(startedAt, completedAt)
        }
      })

      const startedAt = new Date(job.started_at)
      const completedAt = new Date(job.completed_at)
      // job
      return {
        workflowId: String(job.run_id),
        buildNumber: buildNumber, // Github Actions job does not have buildNumber
        jobId: String(job.id),
        jobName: job.name,
        status: this.normalizeStatus(job.conclusion),
        startedAt,
        completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec: _.sumBy(stepReports, 'stepDurationSec'),
        steps: stepReports,
      }
    })

    const startedAt = _.min(jobReports.map((job) => job.startedAt )) || new Date(workflow.created_at)
    const completedAt = _.max(jobReports.map((job) => job.completedAt )) || new Date(workflow.created_at)
    // workflow
    return {
      service: 'github',
      workflowId: String(workflow.id),
      buildNumber: workflow.run_number,
      workflowName: workflowName,
      createdAt: new Date(workflow.created_at),
      trigger: workflow.event,
      status: this.normalizeStatus(workflow.conclusion as unknown as string),
      repository: workflow.repository.full_name,
      headSha: workflow.head_sha,
      branch: workflow.head_branch,
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: _.sumBy(jobReports, 'sumStepsDurationSec')
    }
  }

  normalizeStatus(status: string): Status {
    switch (status) {
      case 'success':
        return 'SUCCESS'
      case 'failure':
        return 'FAILURE'
      case 'cancelled':
        return 'ABORTED'
      case 'timed_out':
        return 'ABORTED'
      default:
        return 'OTHER';
    }
  }
}