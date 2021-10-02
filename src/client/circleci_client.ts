import path from 'path'
import minimatch from 'minimatch'
import { AxiosInstance } from 'axios'
import { groupBy, max, minBy } from 'lodash'
import { Artifact, CustomReportArtifact, createAxios } from './client'
import { CustomReportConfig } from '../config/config'
import { ArgumentOptions } from '../arg_options'
import { Logger } from 'tslog'

const DEBUG_PER_PAGE = 10
const FETCH_RECENT_BUILD_API_NUM = 3

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
    end_time: string | null, // Sometimes step log will be broken and return null
    start_time: string,
    step: number,
    run_time_millis: number | null, // Sometimes step log will be broken and return null
    background: boolean,
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
  last_build_num: number
}

export type TestResponse = {
  exceptions?: unknown[]
  tests: {
    classname: string
    file?: string
    name: string
    result: "success" | "failure" | "skipped"
    run_time: number
    message?: string
    source: string
    source_type: string
  }[]
  run_id: number // Add for join workflow
}

type ArtifactsResponse = {
  path: string,
  prettry_path: string,
  node_index: number,
  url: string,
}[]

export class CircleciClient {
  private axios: AxiosInstance
  constructor(token: string, logger: Logger, private options: ArgumentOptions, baseUrl?: string) {
    if (baseUrl && path.basename(baseUrl) !== 'v1.1') {
      throw `${CircleciClient.name} accepts only "/api/v1.1/" But your baseUrl is ${baseUrl}`
    }
    const axiosLogger = logger.getChildLogger({ name: CircleciClient.name })
    this.axios = createAxios(axiosLogger, {
      baseURL: baseUrl ?? 'https://circleci.com/api/v1.1',
      auth: {
        username: token,
        password: '',
      },
    })
  }

  // https://circleci.com/api/v1.1/project/:vcs-type/:username/:project?circle-token=:token&limit=20&offset=5&filter=completed
  async fetchWorkflowRuns(owner: string, repo: string, vcsType: string, lastRunId?: number) {
    const limit = (this.options.debug) ? DEBUG_PER_PAGE : 100
    let recentBuilds = [] as RecentBuildResponse[]
    for (let index = 0; index < FETCH_RECENT_BUILD_API_NUM; index++) {
      const res = await this.axios.get( `project/${vcsType}/${owner}/${repo}`, {
        params: {
          // API default is 30 and max is 100
          // ref: https://circleci.com/docs/api/#recent-builds-for-a-single-project
          limit: limit,
          // limit: 3,
          offset: index * limit,
          // filter: "completed"
          shallow: true,
        }
      })
      recentBuilds.push(...res.data)
    }
    recentBuilds = (lastRunId)
      ? recentBuilds.filter((build) => build.build_num > lastRunId)
      : recentBuilds

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
      const build_nums = builds.map((build) => build.build_num)
      return {
        workflow_id: build.workflow_id,
        workflow_name: build.workflow_name,
        reponame: build.reponame,
        username: build.username,
        vcs_type: build.vcs_type,
        build_nums,
        lifecycles: builds.map((build) => build.lifecycle),
        last_build_num: max(build_nums)!,
      }
    })

    return this.filterWorkflowRuns(workflowRuns)
  }

  // Filter to: Each workflow's last build number < first running build number
  filterWorkflowRuns (runs: WorkflowRun[]): WorkflowRun[] {
    // Ignore not_run workflows that are [ci-skip] commit OR skipped redundant build
    runs = runs.filter((run) => { return !run.lifecycles.some((lifecycle) => lifecycle === 'not_run') })

    const inprogressRuns = runs.filter((run) => {
      return !run.lifecycles.every((lifecycle) => lifecycle === 'finished')
    })
    const firstInprogress = minBy(
      inprogressRuns,
      (run) => run.last_build_num,
    )
    runs = (firstInprogress)
      ? runs.filter((run) => run.last_build_num < firstInprogress.last_build_num)
      : runs
    return runs
  }

  async fetchWorkflowJobs(workflowRun: WorkflowRun) {
    return await Promise.all(workflowRun.build_nums.map((buildNum) => {
      return this.fetchJobs(
        workflowRun.username,
        workflowRun.reponame,
        workflowRun.vcs_type,
        buildNum
        )
    }))
  }

  // ex: https://circleci.com/api/v1.1/project/github/Kesin11/CIAnalyzer/1021
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

  async fetchWorkflowTests(workflowRun: WorkflowRun) {
    return await Promise.all(workflowRun.build_nums.map((buildNum) => {
      return this.fetchTests(
        workflowRun.username,
        workflowRun.reponame,
        workflowRun.vcs_type,
        buildNum
      )
    }))
  }

  // ex: https://circleci.com/api/v1.1/project/github/Kesin11/CIAnalyzer/1021/tests
  async fetchTests(owner: string, repo: string, vcsType: string, runId: number) {
    const res = await this.axios.get( `project/${vcsType}/${owner}/${repo}/${runId}/tests`)
    return {
      ...res.data,
      run_id: runId
    } as TestResponse
  }

  // ex: https://circleci.com/api/v1.1/project/github/Kesin11/CIAnalyzer/1021/artifacts
  async fetchArtifactsList(owner: string, repo: string, vcsType: string, runId: number): Promise<ArtifactsResponse> {
    const res = await this.axios.get(
      `project/${vcsType}/${owner}/${repo}/${runId}/artifacts`
    )
    return res.data
  }

  async fetchArtifacts(artifactsResponse: ArtifactsResponse): Promise<Artifact[]> {
    const pathResponses = artifactsResponse.map((artifact) => {
      const response = this.axios.get(
        artifact.url,
        { responseType: 'arraybuffer'}
      )
      return { path: artifact.path, response }
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

  async fetchWorkflowCustomReports(workflowRun: WorkflowRun, customReportConfigs: CustomReportConfig[]) {
    return await Promise.all(workflowRun.build_nums.map((buildNum) => {
      return this.fetchCustomReports(
        workflowRun.username,
        workflowRun.reponame,
        workflowRun.vcs_type,
        buildNum,
        customReportConfigs,
      )
    }))
  }

  async fetchCustomReports(owner: string, repo: string, vcsType: string, runId: number, customReportsConfigs: CustomReportConfig[]): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs?.length < 1) return new Map()

    const artifactsResponse = await this.fetchArtifactsList(owner, repo, vcsType, runId)

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>()
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      const reportArtifacts = artifactsResponse.filter((artifact) => {
        return customReportConfig.paths.some((glob) => minimatch(artifact.path, glob))
      })
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(reportArtifacts)
      }
    })
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts)
    }

    return customReports
  }
}
