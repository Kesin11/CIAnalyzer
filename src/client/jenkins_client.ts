import axios, { AxiosInstance } from 'axios'

const DEBUG_PER_PAGE = 5

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

  async fetchWorkflowRuns() {
    const res = await this.axios.get("api/json")

    const jobs = res.data.jobs as JobResponse[]
    return jobs.filter((job) => {
      return job._class === "org.jenkinsci.plugins.workflow.job.WorkflowJob"
    })
  }

  async fetchWorkflows(job: JobResponse) {
    const res = await this.axios.get(`job/${job}/wfapi/runs`, {
      params: {
        fullStages: "true"
      }
    })

    return res.data as WfapiRunResponse[]
  }

  async fetchJobs(job: JobResponse, runId: number) {
    const res = await this.axios.get(`job/${job}/${runId}/wfapi/describe`)

    return res.data as WfapiRunResponse
  }
}
