import axios, { AxiosInstance } from 'axios'
import { groupBy } from 'lodash'

type RecentBuildsResponse = {
  // compare: null,
  // previous_successful_build: null,
  // build_parameters: { CIRCLE_JOB: 'build_and_test' },
  // oss: true,
  // all_commit_details_truncated: false,
  // committer_date: null,
  // body: null,
  // usage_queued_at: '2020-04-29T13:20:15.497Z',
  // context_ids: [],
  // fail_reason: null,
  // retry_of: null,
  reponame: string,
  // ssh_users: [],
  build_url: string,
  // parallel: 1,
  failed: boolean,
  branch: string,
  username: string,
  // author_date: null,
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
  workflows: {
    job_name: string,
    job_id: string,
    workflow_id: string,
    // workspace_id: 'f4e658f6-2eb2-4b34-8da9-e932fc25303f',
    // upstream_job_ids: [Array],
    // upstream_concurrency_map: {},
    workflow_name: string
  },
  vcs_tag: string | null,
  build_num: number,
  // infrastructure_fail: false,
  // committer_email: null,
  // has_artifacts: true,
  // previous: { build_num: 2, status: 'success', build_time_millis: 62381 },
  status: 'retried' | 'canceled' | 'infrastructure_fail' | 'timedout' | 'not_run' | 'running' | 'failed' | 'queued' | 'scheduled' | 'not_running' | 'no_tests' | 'fixed' | 'success'
  // committer_name: null,
  // retries: null,
  // subject: null,
  vcs_type: string,
  // timedout: boolean,
  // dont_build: null,
  lifecycle: 'queued' | 'scheduled' | 'not_run' | 'not_running' | 'running' | 'finished'
  // no_dependency_cache: false,
  stop_time: string,
  // ssh_disabled: false,
  build_time_millis: number,
  // picard: null,
  // circle_yml: null,
  // messages: [],
  // is_first_green_build: false,
  // job_name: null,
  start_time: string,
  // canceler: null,
  // all_commit_details: [],
  // platform: '1.0',
  // outcome: 'success',
  // vcs_url: 'https://github.com/Kesin11/CIAnalyzer',
  // author_name: null,
  // node: null,
  queued_at: string,
  canceled: boolean,
  // author_email: null
}

export type WorkflowRun = {
  workflow_name: string
  workflow_id: string
  reponame: string
  username: string
  build_nums: number[]
  lifecycles: RecentBuildsResponse['lifecycle'][]
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

  async fetchWorkflowRuns(owner: string, repo: string, vscType: string, fromRunId?: number) {
    // https://circleci.com/api/v1.1/project/:vcs-type/:username/:project?circle-token=:token&limit=20&offset=5&filter=completed
    const res = await this.axios.get( `project/${vscType}/${owner}/${repo}`, {
      params: {
        // limit: 20,
        // limit: 3,
        // offset: 5,
        // filter: "completed"
      }
    })
    let recentBuilds = res.data as RecentBuildsResponse[]
    if (fromRunId) {
      recentBuilds.filter((build) => build.build_num > fromRunId)
    }

    const groupedBuilds = groupBy(recentBuilds.map((build) => {
      return {
        workflow_name: build.workflows.workflow_name,
        workflow_id: build.workflows.workflow_id,
        reponame: build.reponame,
        username: build.username,
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
        build_nums: builds.map((build) => build.build_num),
        lifecycles: builds.map((build) => build.lifecycle)
      }
    }).filter((run) => { // Filter workflow which has build that is not finished yet.
      return run.lifecycles.every((lifecycle) => lifecycle === 'finished')
    })

    return workflowRuns
  }

  async fetchWorkflows(owner: string, repo: string) {
  }

  async fetchJobs(owner: string, repo: string, runId: number) {
  }
}