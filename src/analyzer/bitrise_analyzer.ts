import { Analyzer, diffSec, Status, TestReport, WorkflowParams, convertToReportTestSuites } from './analyzer'
import { BuildResponse, BuildLogResponse, App, BitriseStatus } from '../client/bitrise_client'
import { dropWhile, maxBy, takeWhile } from 'lodash'

type WorkflowReport = {
  // workflow
  service: 'bitrise',
  workflowId: string, // = ${app.fullname}-${triggered_workflow}
  workflowRunId: string // = ${app.fullname}-${triggered_workflow}-${build_number}
  buildNumber: number, // = build_number
  workflowName: string, // = triggered_workflow
  createdAt: Date, // = triggered_at
  trigger: string // = triggered_by
  status: Status,
  repository: string, // = app.fullname
  headSha: string, // = commit_hash
  branch: string,
  tag: string,
  jobs: JobReport[],
  startedAt: Date, // = started_on_worker_at
  completedAt: Date // = finished_at
  workflowDurationSec: number // = completedAt - startedAt
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
  successCount: 0 | 1 // = 'SUCCESS': 1, others: 0
  parameters: [] // BitriseAnalyzer does not support build parameters yet
  queuedDurationSec: number // createdAt - startedAt
}

type JobReport = {
  workflowRunId: string, // = workflowRunId
  buildNumber?: number, // undefined. Bitrise Action does not provide job build number
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

type JobParameter = {
  name: string
  value: string
}

type StepLog = {
  name: string
  duration: string
}

export class BitriseAnalyzer implements Analyzer {
  constructor() { }

  createWorkflowParams(app: App, build: BuildResponse): WorkflowParams {
    return {
      workflowId: `${app.fullname}-${build.triggered_workflow}`,
      workflowRunId: `${app.fullname}-${build.triggered_workflow}-${build.build_number}`,
      buildNumber: build.build_number,
      workflowName: build.triggered_workflow,
    }
  }

  createWorkflowReport(app: App, build: BuildResponse, buildLog: BuildLogResponse): WorkflowReport {
    const { workflowId, workflowRunId, buildNumber, workflowName }
      = this.createWorkflowParams(app, build)
    const createdAt = new Date(build.triggered_at)
    const startedAt = new Date(build.started_on_worker_at)
    const completedAt = new Date(build.finished_at)
    const status = this.normalizeStatus(build.status)
    return {
      service: 'bitrise',
      workflowId,
      workflowRunId,
      buildNumber,
      workflowName,
      createdAt: new Date(build.triggered_at),
      trigger: build.triggered_by,
      status,
      repository: app.fullname,
      headSha: build.commit_hash ?? '',
      branch: build.branch,
      tag: build.tag ?? '',
      jobs: [], // TODO
      startedAt: new Date(build.started_on_worker_at),
      completedAt: new Date(build.finished_at),
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: 0, // TODO
      successCount: (status === 'SUCCESS') ? 1 : 0,
      parameters: [],
      queuedDurationSec: diffSec(createdAt, startedAt)
    }
  }

  normalizeStatus(status: BitriseStatus): Status {
    switch (status) {
      case 1:
        return 'SUCCESS'
      case 2:
        return 'FAILURE'
      case 3:
        return 'ABORTED'
      case 4:
        return 'ABORTED'
      default:
        return 'OTHER';
    }
  }

  parseBuildLog(BuildLogResponse: BuildLogResponse): StepLog[] {
    const chunks = BuildLogResponse.log_chunks.reverse()

    // Extract chunk that include summary table 
    const summary = chunks.find((chunk) => chunk.chunk.includes('bitrise summary'))
    if (!summary) return []

    let rows = summary.chunk.split('\n')
    // Filter summary table rows only
    rows = dropWhile(rows, (row) => !row.includes('bitrise summary'))
    rows = takeWhile(rows, (rows) => !rows.includes('Total runtime'))

    const steps = rows
      // Filter row that include name and step
      .filter((row) => row.match(/\d+\s(sec|min)/))
      .map((row) => {
        // Step name
        const names = [...row.matchAll(/;1m(?<name>.+?)\u001b/g)].map((match) => match.groups?.name ?? '')
        const name = maxBy(names, (name) => name.length)
        // Duration
        const duration = row.match(/\d+\.\d+\s(sec|min)/)

        return {
          name: name ? name.trim() : '',
          duration: duration ? duration[0].trim() : ''
        }
      })

    return steps
  }

  async createTestReports(): Promise<TestReport[]> {
    return []
  }
}
