import axios, { AxiosInstance } from 'axios'
import { groupBy } from 'lodash'

const DEBUG_PER_PAGE = 10

export type CircleciStatus = 'retried' | 'canceled' | 'infrastructure_fail' | 'timedout' | 'not_run' | 'running' | 'failed' | 'queued' | 'scheduled' | 'not_running' | 'no_tests' | 'fixed' | 'success'
type RecentBuildResponse = {
  // committer_date: 2020-04-30T08:31:56.000Z,
  // body: '',
  // usage_queued_at: '2020-04-29T13:20:15.497Z',
  reponame: string,
  build_url: string,
  // parallel: 1,
  branch: string,
  username: string,
  // author_date: 2020-04-30T08:31:56.000Z,
  why: string,
  // user: {
  //   is_user: true,
  //   login: 'Kesin11',
  //   avatar_url: 'https://avatars2.githubusercontent.com/u/1324862?v=4',
  //   name: 'Kenta Kase',
  //   vcs_type: 'github',
  //   id: 1324862
  // },
  vcs_revision: string,
  workflows: Workflow,
  vcs_tag: string | null,
  build_num: number,
  // committer_email: kesin1202000@gmail.com,
  status: CircleciStatus
  // committer_name: 'Kenta Kase',
  // subject: 'refactor: Improve import',
  // dont_build: null,
  lifecycle: 'queued' | 'scheduled' | 'not_run' | 'not_running' | 'running' | 'finished'
  // fleet: 'picard',
  stop_time: string,
  build_time_millis: number,
  start_time: string,
  // platform: '2.0',
  // outcome: 'success',
  // vcs_url: 'https://github.com/Kesin11/CIAnalyzer',
  // author_name: Kenta Kase,
  queued_at: string,
  // author_email: kesin1202000@gmail.com
}

type Workflow = {
  job_name: string
  job_id: string
  workflow_id: string
  // workspace_id: 'f4e658f6-2eb2-4b34-8da9-e932fc25303f',
  // upstream_job_ids: [Array],
  // upstream_concurrency_map: {},
  workflow_name: string
}

type Steps = {
  name: string
  actions: {
    name: string
    status: CircleciStatus
    end_time: string,
    start_time: string,
    step: number,
    run_time_millis: number,
  }[]
}

export type SingleBuildResponse = RecentBuildResponse & {
  steps: Steps[]
}

export type WorkflowRun = {
  workflow_name: string
  workflow_id: string
  reponame: string
  username: string
  vcs_type: string,
  build_nums: number[]
  lifecycles: RecentBuildResponse['lifecycle'][]
}

export class CircleciClient {
  private axios: AxiosInstance
  constructor(token: string, baseUrl?: string) {
    this.axios = axios.create({
      baseURL: baseUrl ?? 'https://circleci.com/api/v1.1',
      timeout: 1000,
      auth: {
        username: token,
        password: '',
      },
      // headers: {'X-Custom-Header': 'foobar'}
    });

    if (process.env['CI_ANALYZER_DEBUG']) {
      this.axios.interceptors.request.use(request => {
        console.error('Starting Request: ', request)
        return request
      })
    }
  }

  async fetchWorkflowRuns(owner: string, repo: string, vcsType: string, fromRunId?: number) {
    // https://circleci.com/api/v1.1/project/:vcs-type/:username/:project?circle-token=:token&limit=20&offset=5&filter=completed
    const res = await this.axios.get( `project/${vcsType}/${owner}/${repo}`, {
      params: {
        // API default is 30 and max is 100
        // ref: https://circleci.com/docs/api/#recent-builds-for-a-single-project
        limit: (process.env['CI_ANALYZER_DEBUG']) ? DEBUG_PER_PAGE : 100,
        // limit: 3,
        // offset: 5,
        // filter: "completed"
        shallow: true,
      }
    })
    let recentBuilds = res.data as RecentBuildResponse[]
    if (fromRunId) {
      recentBuilds.filter((build) => build.build_num > fromRunId)
    }

    console.log(`${owner}/${repo}:`, recentBuilds.length)

    // Add dummy workflow data if job is not belong to workflow
    for (const build of recentBuilds) {
      if (!build.workflows) {
        build.workflows = this.createDefaultWorkflow(build)
      }
    }

    const groupedBuilds = groupBy(recentBuilds.map((build) => {
      return {
        workflow_name: build.workflows.workflow_name,
        workflow_id: build.workflows.workflow_id,
        reponame: build.reponame,
        username: build.username,
        vcs_type: vcsType,
        build_num: build.build_num,
        lifecycle: build.lifecycle,
      }
    }), 'workflow_id')
    const workflowRuns: WorkflowRun[] = Object.values(groupedBuilds).map((builds) => {
      const build = builds[0]
      return {
        workflow_id: build.workflow_id,
        workflow_name: build.workflow_name,
        reponame: build.reponame,
        username: build.username,
        vcs_type: build.vcs_type,
        build_nums: builds.map((build) => build.build_num),
        lifecycles: builds.map((build) => build.lifecycle)
      }
    }).filter((run) => { // Filter workflow which has build that is not finished yet.
      return run.lifecycles.every((lifecycle) => lifecycle === 'finished')
    })

    return workflowRuns
  }

  async fetchJobs(owner: string, repo: string, vcsType: string, runId: number) {
    const res = await this.axios.get( `project/${vcsType}/${owner}/${repo}/${runId}`, {})
    const build = res.data
    // Add dummy workflow data if job is not belong to workflow
    if (!build.workflows) {
      build.workflows = this.createDefaultWorkflow(build)
    }
    return build as SingleBuildResponse
  }

  // Create default params for old type job that is not using workflow
  createDefaultWorkflow (data: RecentBuildResponse): Workflow {
    const startTime = new Date(data.start_time)
    const repo = `${data.username}/${data.reponame}`
    return {
      job_name: 'build',
      job_id: `${repo}-build-${startTime.getTime()}`,
      workflow_id: `${repo}-workflow-${startTime.getTime()}`,
      workflow_name: 'workflow'
    }
  }
}