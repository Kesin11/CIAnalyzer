import axios, { AxiosInstance } from 'axios'
import { axiosRequestLogger, Artifact, CustomReportArtifact } from './client'
import { minBy } from 'lodash'
import minimatch from 'minimatch'
import { CustomReportConfig } from '../config/config'

// ref: https://github.com/jenkinsci/pipeline-stage-view-plugin/blob/master/rest-api/src/main/java/com/cloudbees/workflow/rest/external/StatusExt.java
export type JenkinsStatus = 'SUCCESS' | 'FAILED' | 'ABORTED' | 'NOT_EXECUTED' | 'IN_PROGRESS' | 'PAUSED_PENDING_INPUT' | 'UNSTABLE'

type JobResponse = {
  _class : string
  name: string
  url: string
  color: string
}

export type WfapiRunResponse = {
  self: {
    href: string // "/job/ci_analyzer/7/wfapi/describe"
  }
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
  actions: (CauseAction | BuildData | GhprbParametersAction | ParametersAction)[]
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

export class JenkinsClient {
  private axios: AxiosInstance
  constructor(baseUrl: string, user?: string, token?: string) {
    if ((user && !token) || (!user && token)) throw 'Only $JENKSIN_USER or $JENKINS_TOKEN is undefined.'

    const auth = (user && token) ? {
      username: user,
      password: token,
    } : undefined

    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 3000,
      auth,
    });

    if (process.env['CI_ANALYZER_DEBUG']) {
      this.axios.interceptors.request.use(axiosRequestLogger)
    }
  }

  async fetchJobs() {
    const res = await this.axios.get("api/json")

    const jobs = res.data.jobs as JobResponse[]
    return jobs.filter((job) => {
      return job._class === "org.jenkinsci.plugins.workflow.job.WorkflowJob"
    })
  }

  async fetchJobRuns(jobName: string, lastRunId?: number) {
    const res = await this.axios.get(`job/${jobName}/wfapi/runs`, {
      params: {
        fullStages: "true"
      }
    })

    const runs = res.data as WfapiRunResponse[]
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
    const res = await this.axios.get(`job/${jobName}/${runId}/wfapi/describe`)

    return res.data as WfapiRunResponse
  }

  async fetchBuild(jobName: string, runId: number) {
    const res = await this.axios.get(`job/${jobName}/${runId}/api/json`)

    return res.data as BuildResponse
  }

  async fetchArtifacts(jobName: string, runId: number, paths: string[]): Promise<Artifact[]> {
    const pathResponses = paths.map((path) => {
      const response = this.axios.get(
        `job/${jobName}/${runId}/artifact/${path}`,
        { responseType: 'arraybuffer'}
      )
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
