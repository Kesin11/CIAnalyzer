import { Status, Analyzer, secRound } from "./analyzer"
import { WfapiRunResponse, JenkinsStatus, BuildResponse, CauseAction, GhprbParametersAction, BuildData, ParametersAction } from "../client/jenkins_client"
import { sumBy, first } from "lodash"

type WorkflowReport = {
  // workflow
  service: 'jenkins',
  workflowId: string, // = jenkins-$jobName
  workflowRunId: string, // = jenkins-$jobName-$buildNumber: It compatible Jenkins env 'BUILD_TAG'
  buildNumber: number, // number(id)
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
  parameters?: {[key: string]: string}
}

type JobReport = {
  workflowRunId: string, // = workflowRunId
  buildNumber: number, // = workflow buildNumber
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

  createWorkflowReport(jobName: string, run: WfapiRunResponse, build: BuildResponse): WorkflowReport {
    const buildNumber = Number(run.id)
    const workflowRunId = `jenkins-${jobName}-${run.id}`

    const jobReports: JobReport[] = run.stages.map((stage) => {
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
        workflowRunId,
        buildNumber,
        jobId: stage.id,
        jobName: stage.name,
        status: this.normalizeStatus(stage.status),
        startedAt: new Date(stage.startTimeMillis),
        completedAt: new Date(stage.startTimeMillis + stage.durationMillis),
        jobDurationSec: stage.durationMillis / 1000,
        sumStepsDurationSec: secRound(sumBy(stepReports, 'stepDurationSec')),
        steps: stepReports,
      }
    })

    // workflow
    return {
      service: 'jenkins',
      workflowId: `jenkins-${jobName}`,
      workflowRunId,
      buildNumber,
      workflowName: jobName,
      createdAt: new Date(run.startTimeMillis),
      trigger: this.detectTrigger(build),
      status: this.normalizeStatus(run.status),
      repository: this.detectRepository(build),
      headSha: this.detectHeadSha(build),
      branch: this.detectBranch(build),
      jobs: jobReports,
      startedAt: new Date(run.startTimeMillis),
      completedAt: new Date(run.startTimeMillis + run.durationMillis),
      workflowDurationSec: run.durationMillis / 1000,
      sumJobsDurationSec: secRound(sumBy(jobReports, 'sumStepsDurationSec')),
      parameters: this.detectParameters(build),
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

  detectTrigger(build: BuildResponse): string {
    const causeAction = build.actions.find((action) => {
      return action._class === "hudson.model.CauseAction"
    }) as CauseAction | undefined
    if (!causeAction) return ''

    return first(causeAction.causes)?._class ?? ''
  }

  detectRepository(build: BuildResponse): string {
    const action = build.actions.find((action) => {
      return action._class === "hudson.plugins.git.util.BuildData" ||
        action._class === "org.jenkinsci.plugins.ghprb.GhprbParametersAction"
    }) as BuildData | GhprbParametersAction | undefined
    if (!action) return ''

    switch (action._class) {
      case "hudson.plugins.git.util.BuildData":
        return first(action.remoteUrls) ?? ''
      case "org.jenkinsci.plugins.ghprb.GhprbParametersAction":
        const repoParam = action.parameters.find((param) => param.name === "ghprbAuthorRepoGitUrl")
        return repoParam?.value ?? ''
    }
  }

  detectHeadSha(build: BuildResponse): string {
    const action = build.actions.find((action) => {
      return action._class === "hudson.plugins.git.util.BuildData" ||
        action._class === "org.jenkinsci.plugins.ghprb.GhprbParametersAction"
    }) as BuildData | GhprbParametersAction | undefined
    if (!action) return ''

    switch (action._class) {
      case "hudson.plugins.git.util.BuildData":
        return action.lastBuiltRevision.SHA1
      case "org.jenkinsci.plugins.ghprb.GhprbParametersAction":
        const repoParam = action.parameters.find((param) => param.name === "ghprbActualCommit")
        return repoParam?.value ?? ''
    }
  }

  detectBranch(build: BuildResponse): string {
    const action = build.actions.find((action) => {
      return action._class === "hudson.plugins.git.util.BuildData" ||
        action._class === "org.jenkinsci.plugins.ghprb.GhprbParametersAction"
    }) as BuildData | GhprbParametersAction | undefined
    if (!action) return ''

    switch (action._class) {
      case "hudson.plugins.git.util.BuildData":
        const branch = first(action.lastBuiltRevision.branch)?.name
        // Remove 'refs/remotes/origin' prefix.
        const matched = branch?.match(/(refs\/remotes\/origin\/)?(.+)/)
        return (matched && matched[2]) ? matched[2] : ''
      case "org.jenkinsci.plugins.ghprb.GhprbParametersAction":
        const repoParam = action.parameters.find((param) => param.name === "GIT_BRANCH")
        return repoParam?.value ?? ''
    }
  }

  detectParameters(build: BuildResponse): {[key: string]: string} {
    const action = build.actions.find((action) => {
      return action._class === "hudson.model.ParametersAction"
    }) as ParametersAction | undefined
    if (!action) return {}

    return Object.fromEntries(
      action.parameters.map((obj) => [obj.name, obj.value])
    )
  }
}
