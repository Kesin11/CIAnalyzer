import { AxiosInstance } from 'axios'
import { minBy } from 'lodash'
import { createAxios } from './client'

const DEBUG_PER_PAGE = 10
const NOT_FINISHED_STATUS = 0

// /apps/{app-slug}/builds
// The status of the build: not finished (0), successful (1), failed (2), aborted with failure (3), aborted with success (4)
export type BitriseStatus = 0 | 1 | 2 | 3 | 4

type AppsResponse = {
  slug: string // "bc71f23672fbb89c",
  title: string // "FlutterGettingStarted",
  project_type: string // "flutter",
  provider: string // "github",
  repo_owner: string // "Kesin11",
  repo_url: string // "https://github.com/Kesin11/FlutterGettingStarted.git",
  repo_slug: string // "FlutterGettingStarted",
  is_disabled: boolean, // false
  status: number // 1,
  is_public: boolean, // true
  owner: {
    account_type: string // "user",
    name: string // "Kesin11",
    slug: string // "bd47661b1d369a62"
  },
  avatar_url?: string | null // null
}

export type App = {
  slug: string
  fullname: string
}

export type BuildResponse = {
  triggered_at: string // "2020-11-22T09:45:54Z",
  started_on_worker_at: string // "2020-11-22T09:45:55Z",
  environment_prepare_finished_at: string // "2020-11-22T09:45:55Z",
  finished_at: string // "2020-11-22T09:53:34Z",
  slug: string // "463a0adea17cd32d",
  status: BitriseStatus // 2,
  status_text: string // "error",
  abort_reason: string | null // null,
  is_on_hold: boolean // false,
  branch: string // "master",
  build_number: number // 9,
  commit_hash: string | null // null,
  commit_message: string | null // null,
  tag: string | null // null,
  triggered_workflow: string // "primary",
  triggered_by: string // "manual-Kesin11",
  machine_type_id: string // "standard",
  stack_identifier: string // "osx-vs4mac-stable",
  original_build_params: {
    branch: string // "master"
  },
  pull_request_id: number // 0,
  pull_request_target_branch: string | null // null,
  pull_request_view_url: string | null // null,
  commit_view_url: string | null // null
}

export type BuildLogResponse = {
  expiring_raw_log_url: string,
  generated_log_chunks_num: number // 42,
  is_archived: boolean // true,
  log_chunks: {
    chunk: string // log test
    position: number // 32
  }[]
  timestamp: null // null
}

// type ArtifactsResponse = {
//   path: string,
//   prettry_path: string,
//   node_index: number,
//   url: string,
// }[]

export class BitriseClient {
  private axios: AxiosInstance
  constructor(token: string, baseUrl?: string) {
    this.axios = createAxios({
      baseURL: baseUrl ?? 'https://api.bitrise.io/v0.1',
      headers: {'Authorization': token },
    })
  }

  // https://api-docs.bitrise.io/#/application/app-list
  async fetchApps() {
    const res = await this.axios.get( `apps`, {
      params: {
        sort_by: 'last_build_at'
      }
    })
    const apps = res.data.data as AppsResponse[]
    return apps
      .filter((app) => app.is_disabled === false)
      .map((app) => {
        return {
          slug: app.slug,
          fullname: `${app.repo_owner}/${app.repo_slug}`
        }
      })
  }

  // https://api-docs.bitrise.io/#/builds/build-list
  async fetchBuilds(appSlug: string, lastRunId?: number) {
    const res = await this.axios.get( `apps/${appSlug}/builds`, {
      params: {
        sort_by: 'created_at',
        // API default is 50 and max is unknown
        limit: (process.env['CI_ANALYZER_DEBUG']) ? DEBUG_PER_PAGE : 100,
      }
    })
    let builds = res.data.data as BuildResponse[]
    return this.filterBuilds(builds, lastRunId)
  }

  // Filter to: lastRunId < Id < firstInprogressId
  filterBuilds (builds: BuildResponse[], lastRunId?: number): BuildResponse[] {
    builds = (lastRunId)
      ? builds.filter((build) => build.build_number > lastRunId)
      : builds
    const firstInprogress = minBy(
      builds.filter((build) => build.status === NOT_FINISHED_STATUS ),
      (build) => build.build_number
    )
    builds = (firstInprogress)
      ? builds.filter((build) => build.build_number < firstInprogress.build_number)
      : builds
    return builds
  }

  // https://api-docs.bitrise.io/#/builds/build-log
  async fetchJobLog(appSlug: string, buildSlug: string) {
    const res = await this.axios.get( `apps/${appSlug}/builds/${buildSlug}/log`, {})
    return res.data as BuildLogResponse
  }

  // async fetchTests(owner: string, repo: string, vcsType: string, runId: number) {
  //   const res = await this.axios.get( `project/${vcsType}/${owner}/${repo}/${runId}/tests`)
  //   return {
  //     ...res.data,
  //     run_id: runId
  //   } as TestResponse
  // }

  // async fetchArtifactsList(owner: string, repo: string, vcsType: string, runId: number): Promise<ArtifactsResponse> {
  //   const res = await this.axios.get(
  //     `project/${vcsType}/${owner}/${repo}/${runId}/artifacts`
  //   )
  //   return res.data
  // }

  // async fetchArtifacts(artifactsResponse: ArtifactsResponse): Promise<Artifact[]> {
  //   const pathResponses = artifactsResponse.map((artifact) => {
  //     const response = this.axios.get(
  //       artifact.url,
  //       { responseType: 'arraybuffer'}
  //     )
  //     return { path: artifact.path, response }
  //   })

  //   const artifacts = []
  //   for (const { path, response } of pathResponses) {
  //     artifacts.push({
  //       path,
  //       data: (await response).data as ArrayBuffer
  //     })
  //   }
  //   return artifacts
  // }

  // async fetchCustomReports(owner: string, repo: string, vcsType: string, runId: number, customReportsConfigs: CustomReportConfig[]): Promise<CustomReportArtifact> {
  //   // Skip if custom report config are not provided
  //   if (customReportsConfigs?.length < 1) return new Map()

  //   const artifactsResponse = await this.fetchArtifactsList(owner, repo, vcsType, runId)

  //   // Fetch artifacts in parallel
  //   const customReports: CustomReportArtifact = new Map<string, Artifact[]>()
  //   const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
  //     const reportArtifacts = artifactsResponse.filter((artifact) => {
  //       return customReportConfig.paths.some((glob) => minimatch(artifact.path, glob))
  //     })
  //     return {
  //       name: customReportConfig.name,
  //       artifacts: this.fetchArtifacts(reportArtifacts)
  //     }
  //   })
  //   for (const { name, artifacts } of nameArtifacts) {
  //     customReports.set(name, await artifacts)
  //   }

  //   return customReports
  // }
}
