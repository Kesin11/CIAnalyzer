import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import { sumBy, min, max } from 'lodash'
import { Analyzer, diffSec, Status } from './analyzer'
export type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listRepoWorkflowRuns']['response']['data']['workflow_runs'][0]
export type JobsItem = RestEndpointMethodTypes['actions']['listJobsForWorkflowRun']['response']['data']['jobs']

type WorkflowReport = {
  // workflow
  service: 'github',
  workflowId: string, // = ${repositroy}-${workflowName}
  workflowRunId: string // = ${repository}-${workflowName}-${buildNumber}
  buildNumber: number, // = run_number
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

type JobReport = {
  workflowRunId: string, // = workflowRunId
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

type StepReport = {
  name: string,
  status: Status,
  number: number,
  startedAt: Date,
  completedAt: Date,
  stepDurationSec: number // completedAt - startedAt
}

export class GithubAnalyzer implements Analyzer {
  constructor() { }

  createWorkflowReport(workflowName: string, workflow: WorkflowRunsItem, jobs: JobsItem): WorkflowReport {
    const buildNumber = workflow.run_number
    const repository = workflow.repository.full_name
    const workflowId = `${repository}-${workflowName}`
    const workflowRunId = `${repository}-${workflowName}-${buildNumber}`

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
        workflowRunId: workflowRunId,
        buildNumber: buildNumber, // Github Actions job does not have buildNumber
        jobId: String(job.id),
        jobName: job.name,
        status: this.normalizeStatus(job.conclusion),
        startedAt,
        completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec: sumBy(stepReports, 'stepDurationSec'),
        steps: stepReports,
      }
    })

    const startedAt = min(jobReports.map((job) => job.startedAt )) || new Date(workflow.created_at)
    const completedAt = max(jobReports.map((job) => job.completedAt )) || new Date(workflow.created_at)
    // workflow
    return {
      service: 'github',
      workflowId,
      buildNumber,
      workflowRunId,
      workflowName,
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
      sumJobsDurationSec: sumBy(jobReports, 'sumStepsDurationSec'),
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
