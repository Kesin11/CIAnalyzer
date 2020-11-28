import { Analyzer, diffSec, Status, TestReport, WorkflowParams, convertToReportTestSuites, secRound } from './analyzer'
import { BuildResponse, BuildLogResponse, App, BitriseStatus } from '../client/bitrise_client'
import { dropWhile, maxBy, sumBy, takeWhile } from 'lodash'

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
    const steps = this.createStepReports(startedAt, buildLog)
    const sumStepsDurationSec = secRound(sumBy(steps, 'stepDurationSec'))
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
      jobs: [{
        workflowRunId,
        buildNumber,
        jobId: workflowRunId,
        jobName: workflowName,
        status: status,
        startedAt: startedAt,
        completedAt: completedAt,
        jobDurationSec: diffSec(startedAt, completedAt),
        sumStepsDurationSec,
        steps: steps
      }],
      startedAt,
      completedAt,
      workflowDurationSec: diffSec(startedAt, completedAt),
      sumJobsDurationSec: sumStepsDurationSec,
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

  createStepReports(startedAt: Date, buildLog: BuildLogResponse): StepReport[] {
    const steps = this.parseBuildLog(buildLog)
    let stepSumMilisec = 0
    return steps.map((step, index) => {
      const stepStartedTime = startedAt.getTime() + stepSumMilisec
      const stepMilisec = this.detectStepMilisec(step.duration)
      const stepCompletedTime = stepStartedTime + stepMilisec
      stepSumMilisec += stepMilisec

      return {
        name: this.detectStepName(step.name),
        status: this.detectStepStatus(step.name),
        number: index,
        startedAt: new Date(stepStartedTime),
        completedAt: new Date(stepCompletedTime),
        stepDurationSec: secRound(stepMilisec / 1000),
      }
    })
  }

  detectStepMilisec(durationStr: string): number {
    const [time, unit ] = durationStr.split(' ')
    switch (unit) {
      case 'sec':
        return Number(time) * 1000
      case 'min':
        return Number(time) * 60 * 1000
      default:
        return Number(time) * 1000
    }
  }

  detectStepName(stepName: string): string {
    return stepName.replace(/\s\(exit code:.+\)$/, '')
  }

  detectStepStatus(stepName: string): Status {
    // TODO: Bitriseのログを色々見てどういうケースがあるのか調べる
    if (stepName.includes('exit code: 1')) return 'FAILURE'
    return 'SUCCESS'
  }

  async createTestReports(): Promise<TestReport[]> {
    return []
  }
}
