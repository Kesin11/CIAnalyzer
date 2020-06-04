import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import { sumBy, min, max } from 'lodash'
import { Analyzer, diffSec, Status, TestReport } from './analyzer'
import { RepositoryTagMap } from '../client/github_repository_client'
import { TestSuites, parse } from 'junit2json'
import AdmZip from 'adm-zip'
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
  tag: string, // Detect from Github API response
  jobs: JobReport[],
  startedAt: Date, // = min(jobs startedAt)
  completedAt: Date // = max(jobs completedAt)
  workflowDurationSec: number // = completedAt - startedAt
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
  successCount: 0 | 1 // = 'SUCCESS': 1, others: 0
  parameters: [] // GithubAnalyzer does not support build parameters yet
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

  createWorkflowReport(workflowName: string, workflow: WorkflowRunsItem, jobs: JobsItem, tagMap: RepositoryTagMap): WorkflowReport {
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
    const status = this.normalizeStatus(workflow.conclusion as unknown as string)
    // workflow
    return {
      service: 'github',
      workflowId,
      buildNumber,
      workflowRunId,
      workflowName,
      createdAt: new Date(workflow.created_at),
      trigger: workflow.event,
      status,
      repository: workflow.repository.full_name,
      headSha: workflow.head_sha,
      branch: workflow.head_branch,
      tag: tagMap.get(workflow.head_sha) ?? '',
      jobs: jobReports,
      startedAt,
      completedAt,
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: sumBy(jobReports, 'sumStepsDurationSec'),
      successCount: (status === 'SUCCESS') ? 1 : 0,
      parameters: []
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

  async createTestReports(workflowName: string, workflow: WorkflowRunsItem, tests: AdmZip.IZipEntry[]): Promise<TestReport[]> {
    const buildNumber = workflow.run_number
    const repository = workflow.repository.full_name
    const workflowId = `${repository}-${workflowName}`
    const workflowRunId = `${repository}-${workflowName}-${buildNumber}`

    const testReports: TestReport[] = []
    for (const test of tests) {
      const xmlString = test.getData().toString('utf-8')
      try {
        const testSuites = await parse(xmlString)
        testReports.push({
          workflowId,
          workflowRunId,
          buildNumber,
          workflowName,
          testSuites,
        })
      } catch (error) {
        console.error(`Error: Could not parse as JUnit XML. ${test.entryName}`)
      }
    }
    return testReports
  }
}
