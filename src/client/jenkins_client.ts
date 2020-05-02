import axios, { AxiosInstance } from 'axios'

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
  actions: (CauseAction | BuildData | GhprbParametersAction)[]
}

export type CauseAction = {
  _class: "hudson.model.CauseAction"
  causes: {
    "_class": "hudson.model.Cause$UserIdCause" | "hudson.triggers.SCMTrigger$SCMTriggerCause" | "org.jenkinsci.plugins.ghprb.GhprbCause"
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

export class JenkinsClient {
  private axios: AxiosInstance
  constructor(baseUrl: string, user?: string, token?: string) {
    // TODO: Show warning if only USER or TOKEN is undefined.
    const auth = (user && token) ? {
      username: user,
      password: token,
    } : undefined

    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 1000,
      auth,
    });

    if (process.env['CI_ANALYZER_DEBUG']) {
      this.axios.interceptors.request.use(request => {
        console.error('Starting Request: ', request)
        return request
      })
    }
  }

  async fetchJobs() {
    const res = await this.axios.get("api/json")

    const jobs = res.data.jobs as JobResponse[]
    return jobs.filter((job) => {
      return job._class === "org.jenkinsci.plugins.workflow.job.WorkflowJob"
    })
  }

  async fetchJobRuns(job: JobResponse) {
    const res = await this.axios.get(`job/${job.name}/wfapi/runs`, {
      params: {
        fullStages: "true"
      }
    })

    return res.data as WfapiRunResponse[]
  }

  async fetchJobRun(job: JobResponse, runId: number) {
    const res = await this.axios.get(`job/${job.name}/${runId}/wfapi/describe`)

    return res.data as WfapiRunResponse
  }

  async fetchBuild(job: JobResponse, runId: number) {
    const res = await this.axios.get(`job/${job.name}/${runId}/api/json`)

    return res.data as BuildResponse
  }
}
