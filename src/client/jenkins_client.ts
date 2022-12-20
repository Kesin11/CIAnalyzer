import { AxiosInstance } from 'axios'
import { Artifact, CustomReportArtifact, createAxios } from './client'
import { minBy } from 'lodash'
import minimatch from 'minimatch'
import { CustomReportConfig } from '../config/config'
import { Logger } from 'tslog'
import { ArgumentOptions } from '../arg_options'

// ref: https://github.com/jenkinsci/pipeline-stage-view-plugin/blob/master/rest-api/src/main/java/com/cloudbees/workflow/rest/external/StatusExt.java
export type JenkinsStatus = 'SUCCESS' | 'FAILED' | 'ABORTED' | 'NOT_EXECUTED' | 'IN_PROGRESS' | 'PAUSED_PENDING_INPUT' | 'UNSTABLE'

type JobResponse = {
  _class : string
  name: string
  url: string
  color: string
}

export type WfapiRunResponse = {
  _links: {
    self: {
      href: string // "/job/ci_analyzer/7/wfapi/describe"
    },
    artifacts: {
      href: string // "/job/ci_analyzer/7/wfapi/artifacts"
    }
  },
  id: string // '16',
  name: string // '#16',
  status: JenkinsStatus // 'SUCCESS',
  startTimeMillis: number // 1588392912311,
  endTimeMillis: number // 1588393121925,
  durationMillis: number // 209614,
  queueDurationMillis: number // 3,
  pauseDurationMillis: number // 0,
  stages: Stage[]
}

type Stage = {
  _links: {
    self: {
      href: string // "/job/ci_analyzer/9/execution/node/6/wfapi/describe"
    }
  },
  id: string // "6",
  name: string // "Declarative: Checkout SCM",
  execNode: string // "",
  status: JenkinsStatus // "SUCCESS",
  error?: {
    message: string // "script returned exit code 243",
    type: string // "hudson.AbortException"
  }
  startTimeMillis: number // 1588343995998,
  durationMillis: number // 1410,
  pauseDurationMillis: number // 0,
  stageFlowNodes: StageFlowNode[]
}

type StageFlowNode = {
  _links: {
    self: {
      href: string // "/job/ci_analyzer/9/execution/node/7/wfapi/describe"
    },
    log: {
      href: string // "/job/ci_analyzer/9/execution/node/7/wfapi/log"
    },
    console: {
      href: string // "/job/ci_analyzer/9/execution/node/7/log"
    }
  }
  id: string // "7",
  name: string // "Check out from version control",
  execNode: string // "",
  status: JenkinsStatus // "SUCCESS",
  error?: {
    message: string // "script returned exit code 1",
    type: string // "hudson.AbortException"
  }
  parameterDescription?: string // "docker pull node:lts",
  startTimeMillis: number // 1588343996020,
  durationMillis: number // 1377,
  pauseDurationMillis: number // 0,
  parentNodes: string[] // [ "6" ]
}

export type BuildResponse = {
  id: string // '80'
  number: number // 80
  fullDisplayName: string // "ci_analyzer #90",
  timestamp: number // 1605412528346 (milisec timestamp)
  actions: (
    CauseAction |
    BuildData |
    GhprbParametersAction | // from GitHub Pull Request Builder plugin
    ParametersAction |
    TimeInQueueAction // from Metrics plugin
  )[]
  artifacts: {
    displayPath: string // "junit.xml",
    fileName: string // "junit.xml",
    relativePath: string // "junit/junit.xml"
  }[]
}

export type CauseAction = {
  _class: "hudson.model.CauseAction"
  causes: {
    "_class":
      "hudson.model.Cause$UserIdCause" |
      "hudson.triggers.SCMTrigger$SCMTriggerCause" |
      "org.jenkinsci.plugins.ghprb.GhprbCause" |
      "hudson.triggers.TimerTrigger$TimerTriggerCause"
  }[]
}

export type BuildData = {
  _class: "hudson.plugins.git.util.BuildData"
  lastBuiltRevision: {
    SHA1: string // "9db2c418143a661d07b7458debe0b7bced0cdb47"
    branch: {
      SHA1: string // "9db2c418143a661d07b7458debe0b7bced0cdb47"
      name: string // "refs/remotes/origin/feature/jenkinsfile"
    }[]
  }
  remoteUrls: string[] // "https://github.com/Kesin11/CIAnalyzer.git"
}

export type GhprbParametersAction = {
  _class: "org.jenkinsci.plugins.ghprb.GhprbParametersAction"
  parameters: (
    {
      _class: "hudson.model.StringParameterValue"
      name: "ghprbActualCommit"
      value: string // "ee0f40fec52d69d2961a726c1284002675b3d68a"
    } |
    {
      _class: "hudson.model.StringParameterValue"
      name: "ghprbAuthorRepoGitUrl"
      value: string // "https://github.com/Kesin11/CIAnalyzer.git"
    } |
    {
      _class: "hudson.model.StringParameterValue"
      name: "GIT_BRANCH"
      value: string // "feature/jenkinsfile"
    } |
    {
      _class: "hudson.model.StringParameterValue"
      name: "ghprbGhRepository"
      value: string // "Kesin11/CIAnalyzer"
    }
  )[]
}

export type ParametersAction = {
  _class: "hudson.model.ParametersAction"
  parameters:
    {
      _class: string // ex: "hudson.model.StringParameterValue"
      name: string // "TIMEOUT",
      value?: string | number | boolean // "10"
    }[]
}

export type TimeInQueueAction = {
  _class : "jenkins.metrics.impl.TimeInQueueAction",
  blockedDurationMillis : number,
  blockedTimeMillis : number,
  buildableDurationMillis : number, // Freestyle job queued time
  buildableTimeMillis : number, // Pipeline job queued time
  buildingDurationMillis : number,
  executingTimeMillis : number,
  executorUtilization : number,
  subTaskCount : number,
  waitingDurationMillis : number,
  waitingTimeMillis : number
}

export class JenkinsClient {
  #axios: AxiosInstance
  #options: ArgumentOptions
  constructor(baseUrl: string, logger: Logger<unknown>, options: ArgumentOptions, user?: string, token?: string) {
    if ((user && !token) || (!user && token)) throw new Error('Either $JENKSIN_USER or $JENKINS_TOKEN is undefined.')

    const auth = (user && token) ? {
      username: user,
      password: token,
    } : undefined

    this.#options = options
    const axiosLogger = logger.getSubLogger({ name: JenkinsClient.name })
    this.#axios = createAxios(axiosLogger, options, {
      baseURL: baseUrl,
      auth,
    })
  }

  async fetchJobs(isRecursively: boolean) {
    const script = `
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import groovy.json.JsonBuilder

def jobs = Jenkins.instance.getAllItems(WorkflowJob.class).collect{
  [
    '_class': 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
    'name': it.fullName.replaceAll('/', '/job/'),
    'url': it.absoluteUrl,
    'color': it.getIconColor().toString().toLowerCase()
  ]
}
def obj = ['jobs': jobs]
def builder = new JsonBuilder(obj)

println builder.toString()
    `
    const params = new URLSearchParams({ script: script })
    const res = (isRecursively)
      ? await this.#axios.post("scriptText", params)
      : await this.#axios.get("api/json")

    const jobs = res.data.jobs as JobResponse[]
    return jobs.filter((job) => {
      return job._class === "org.jenkinsci.plugins.workflow.job.WorkflowJob"
    })
  }

  async fetchJobRuns(jobName: string, lastRunId?: number) {
    const url = encodeURI(`job/${jobName}/wfapi/runs`)
    let runs: WfapiRunResponse[]
    try {
      const res = await this.#axios.get(url, {
        params: {
          fullStages: "true"
        }
      })
      runs = res.data
    }
    // Sometimes wfapi/runs return 500.
    // However if that job comes from `correctAllJobs` config option, user may not do anything.
    // To handle this situation, catch the error and return empty array.
    catch { return [] }

    return this.filterJobRuns(runs, lastRunId)
  }

  // Filter to: lastRunId < Id < firstInprogressId
  filterJobRuns (runs: WfapiRunResponse[], lastRunId?: number): WfapiRunResponse[] {
    runs = (lastRunId)
      ? runs.filter((run) => Number(run.id) > lastRunId)
      : runs
    const firstInprogress = minBy(
      runs.filter((run) => run.status === 'IN_PROGRESS' ),
      (run) => Number(run.id)
    )
    runs = (firstInprogress)
      ? runs.filter((run) => Number(run.id) < Number(firstInprogress.id))
      : runs
    return runs
  }

  async fetchJobRun(jobName: string, runId: number) {
    const url = encodeURI(`job/${jobName}/${runId}/wfapi/describe`)
    const res = await this.#axios.get(url)

    return res.data as WfapiRunResponse
  }

  async fetchBuild(jobName: string, runId: number) {
    const url = encodeURI(`job/${jobName}/${runId}/api/json`)
    const res = await this.#axios.get(url)

    return res.data as BuildResponse
  }

  async fetchLastBuild(jobName: string) {
    const url = encodeURI(`/job/${jobName}/lastBuild/api/json`)
    const res = await this.#axios.get(url)

    return res.data as BuildResponse
  }

  async fetchArtifacts(jobName: string, runId: number, paths: string[]): Promise<Artifact[]> {
    const pathResponses = paths.map((path) => {
      const url = encodeURI(`job/${jobName}/${runId}/artifact/${path}`)
      const response = this.#axios.get(url, { responseType: 'arraybuffer'})
      return { path, response }
    })

    const artifacts = []
    for (const { path, response } of pathResponses) {
      artifacts.push({
        path,
        data: (await response).data as ArrayBuffer
      })
    }
    return artifacts
  }

  async fetchTests(build: BuildResponse, globs: string[]): Promise<Artifact[]> {
    // Skip if test file globs not provided
    if (globs.length < 1) return []

    const artifactPaths = build.artifacts.map((artifact) => artifact.relativePath )
    const testPaths = artifactPaths.filter((path) => {
      return globs.some((glob) => minimatch(path, glob))
    })

    const jobName = build.fullDisplayName.split(' ')[0]
    return this.fetchArtifacts(jobName, build.number, testPaths)
  }

  async fetchCustomReports(build: BuildResponse, customReportsConfigs: CustomReportConfig[]): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs.length < 1) return new Map()

    const artifactPaths = build.artifacts.map((artifact) => artifact.relativePath )
    const jobName = build.fullDisplayName.split(' ')[0]

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>()
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      const reportArtifactsPaths = artifactPaths.filter((path) => {
        return customReportConfig.paths.some((glob) => minimatch(path, glob))
      })
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(jobName, build.number, reportArtifactsPaths)
      }
    })
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts)
    }

    return customReports
  }
}
