import { sumBy, min, max, sortBy, first, last } from "lodash"
import { Status, diffSec, Analyzer, secRound } from "./analyzer"
import { WorkflowRun, SingleBuildResponse, CircleciStatus } from "../client/circleci_client"
import { RepositoryTagMap } from "../client/github_repository_client"

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
  workflowDurationSec: number // = sum(job jobDurationSec)
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
  successCount: 0 | 1 // = 'SUCCESS': 1, others: 0
  parameters: [] // CircleciAnalyzer does not support output build parameters yet
}

type JobReport = {
  workflowRunId: string, // = workflowRunId
  buildNumber: number, // = build_number
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

  createWorkflowReport( workflowRun: WorkflowRun, jobs: SingleBuildResponse[], tagMap: RepositoryTagMap): WorkflowReport {
    const sortedJobs = sortBy(jobs, 'build_num')
    const firstJob = first(sortedJobs)!
    const lastJob = last(sortedJobs)!
    const repository = `${firstJob.username}/${firstJob.reponame}`
    const workflowName = workflowRun.workflow_name
    const workflowBuildNumber = lastJob.build_num
    const workflowRunId = `${repository}-${workflowName}-${workflowBuildNumber}`

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
      }
    })

    const startedAt = min(jobReports.map((job) => job.startedAt ))!
    const completedAt = max(jobReports.map((job) => job.completedAt ))!
    const status = this.normalizeStatus(lastJob.status)
    // workflow
    return {
      service: 'circleci',
      workflowId: `${repository}-${workflowName}` ,
      buildNumber: workflowBuildNumber,
      workflowRunId,
      workflowName,
      createdAt: min(jobs.map((job) => new Date(job.queued_at)))!,
      trigger: firstJob.why,
      status,
      repository,
      headSha: firstJob.vcs_revision,
      branch: firstJob.branch,
      tag: tagMap.get(firstJob.vcs_revision) ?? '',
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: secRound(sumBy(jobReports, 'jobDurationSec')),
      sumJobsDurationSec: secRound(sumBy(jobReports, 'sumStepsDurationSec')),
      successCount: (status === 'SUCCESS') ? 1 : 0,
      parameters: [],
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