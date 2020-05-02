import { Status, Analyzer } from "./analyzer"
import { WfapiRunResponse, JenkinsStatus } from "../client/jenkins_client"
import { sumBy } from "lodash"

type WorkflowReport = {
  // workflow
  service: 'jenkins',
  workflowId: string, // = jenkins-$jobName-$buildNumber: Jenkins env 'buildTag' compatible
  buildNumber?: number, // number(id)
  workflowName: string, // jobName
  createdAt: Date, // = Date(startTimeMillis)
  trigger: string // build api: causes[0]._class or ghprb
  status: Status,
  repository: string, // build api: remoteUrls[0]
  headSha: string, // = build api: lastBuiltRevision.SHA1 or sha1
  branch: string, // = build api: lastBuiltRevision.branch[0].name or GIT_BRANCH
  jobs: JobReport[],
  startedAt: Date, // = Date(startTimeMillis)
  completedAt: Date // = Date(endTimeMillis)
  workflowDurationSec: number // = durationMillis / 1000
  sumJobsDurationSec: number // = sum(jobs sumStepsDurationSec)
}

type JobReport = {
  workflowId: string, // = workflow name
  buildNumber?: number, // = workflow buildNumber
  jobId: string, // = stage.id
  jobName: string, // stage.name
  status: Status,
  startedAt: Date, // Date(startTimeMillis)
  completedAt: Date, // Date(startTimeMillis + durationMillis)
  jobDurationSec: number, // = durationMillis
  sumStepsDurationSec: number // = sum(steps duration)
  steps: StepReport[],
}

type StepReport = {
  name: string, // = flowNode.parameterDescription ?? flowNode.name 
  status: Status,
  number: number, // = number(id)
  startedAt: Date, // Date(startTimeMillis)
  completedAt: Date, // Date(startTimeMillis + durationMillis)
  stepDurationSec: number // durationMillis / 1000
}

export class JenkinsAnalyzer implements Analyzer {
  constructor() { }

  createWorkflowReport(jobName: string, job: WfapiRunResponse): WorkflowReport {
    const workflowId = `jenkins-${jobName}-${job.id}`
    const jobReports: JobReport[] = job.stages.map((stage) => {
      const stepReports: StepReport[] = stage.stageFlowNodes.map((node) => {
        // step
        return {
          name: node.parameterDescription ?? node.name,
          status: this.normalizeStatus(node.status),
          number: Number(node.id),
          startedAt: new Date(node.startTimeMillis),
          completedAt: new Date(node.startTimeMillis + node.durationMillis),
          stepDurationSec: node.durationMillis / 1000,
        }
      })

      // job
      return {
        workflowId: workflowId,
        buildNumber: undefined,
        jobId: stage.id,
        jobName: stage.name,
        status: this.normalizeStatus(stage.status),
        startedAt: new Date(stage.startTimeMillis),
        completedAt: new Date(stage.startTimeMillis + stage.durationMillis),
        jobDurationSec: stage.durationMillis / 1000,
        sumStepsDurationSec: sumBy(stepReports, 'stepDurationSec'),
        steps: stepReports,
      }
    })

    // workflow
    return {
      service: 'jenkins',
      workflowId: workflowId,
      buildNumber: Number(job.id),
      workflowName: jobName,
      createdAt: new Date(job.startTimeMillis),
      trigger: '', // TODO
      status: this.normalizeStatus(job.status),
      repository: '', // TODO
      headSha: '', // TODO
      branch: '', // TODO
      jobs: jobReports,
      startedAt: new Date(job.startTimeMillis),
      completedAt: new Date(job.startTimeMillis + job.durationMillis),
      workflowDurationSec: job.durationMillis / 1000,
      sumJobsDurationSec: sumBy(jobReports, 'sumStepsDurationSec')
    }
  }

  normalizeStatus(status: JenkinsStatus): Status {
    switch (status) {
      case 'SUCCESS':
        return 'SUCCESS'
      case 'UNSTABLE':
        return 'FAILURE'
      case 'FAILED':
        return 'FAILURE'
      case 'ABORTED':
        return 'ABORTED'
      default:
        return 'OTHER';
    }
  }
}