import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import axios, { AxiosInstance } from 'axios'
import { axiosRequestLogger, CustomReportArtifact, Artifact } from './client'
import { minBy } from "lodash";
import { ZipExtractor } from "../zip_extractor";
import { CustomReportConfig } from "../config/config";

// Oktokit document: https://octokit.github.io/rest.js/v18#actions

const DEBUG_PER_PAGE = 10

type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']['data']['workflow_runs'][0]
// see: https://developer.github.com/v3/checks/runs/#create-a-check-run
type RunStatus = 'queued' | 'in_progress' | 'completed'

export type RepositoryTagMap = Map<string, string>

export class GithubClient {
  private octokit: Octokit
  private axios: AxiosInstance
  constructor(token: string, baseUrl?: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: (baseUrl) ? baseUrl : 'https://api.github.com',
      log: (process.env['CI_ANALYZER_DEBUG']) ? console : undefined,
    })

    this.axios = axios.create({
      baseURL: (baseUrl) ? baseUrl : 'https://api.github.com',
      timeout: 5000,
      auth: { username: '', password: token },
    });

    if (process.env['CI_ANALYZER_DEBUG']) {
      this.axios.interceptors.request.use(axiosRequestLogger)
    }
  }

  // see: https://developer.github.com/v3/actions/workflow-runs/#list-repository-workflow-runs
  async fetchWorkflowRuns(owner: string, repo: string, lastRunId?: number) {
    const workflows = await this.fetchWorkflows(owner, repo)
    const workflowIdMap = new Map((
      workflows.map((workflow) => [String(workflow.id), workflow.name])
    ))

    const runs = await this.octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      per_page: (process.env['CI_ANALYZER_DEBUG']) ? DEBUG_PER_PAGE : 100, // API default is 100
      // page: 1, // order desc
    })

    const filterdWorkflowRuns = this.filterWorkflowRuns(runs.data.workflow_runs, lastRunId)

    // Attach workflow name
    return filterdWorkflowRuns.map((run) => {
      const workflowId = run.workflow_url.split('/').pop()! // parse workflow_url
      return {
        name: workflowIdMap.get(workflowId)!,
        run: run
      }
    })
  }

  // Filter to: lastRunId < Id < firstInprogressId
  filterWorkflowRuns (runs: WorkflowRunsItem[], lastRunId?: number): WorkflowRunsItem[] {
    runs = (lastRunId)
      ? runs.filter((run) => run.run_number > lastRunId)
      : runs
    const firstInprogress = minBy(
      runs.filter((run) => run.status as RunStatus === 'in_progress'),
      (run) => run.run_number
    )
    runs = (firstInprogress)
      ? runs.filter((run) => run.run_number < firstInprogress.run_number)
      : runs
    return runs
  }

  // see: https://developer.github.com/v3/actions/workflows/#list-repository-workflows
  async fetchWorkflows(owner: string, repo: string) {
    const workflows = await this.octokit.actions.listRepoWorkflows({
      owner,
      repo,
    })

    return workflows.data.workflows
  }


  // see: https://developer.github.com/v3/actions/workflow-jobs/#list-jobs-for-a-workflow-run
  async fetchJobs(owner: string, repo: string, runId: number) {
    const jobs = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId
    })
    return jobs.data.jobs
  }

  async fetchArtifacts(owner: string, repo: string, runId: number, globs: string[]): Promise<Artifact[]> {
    const res = await this.octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId
    })

    const nameResponse = res.data.artifacts.map((artifact) => {
      const response = this.axios.get(
        artifact.archive_download_url,
        { responseType: 'arraybuffer'}
      )
      return { name: artifact.name, response }
    })

    // Unarchive zip artifacts
    const zipExtractor = new ZipExtractor()
    for (const { name, response } of nameResponse) {
      await zipExtractor.put(name, (await response).data)
    }
    const zipEntries = await zipExtractor.extract(globs)
    await zipExtractor.rmTmpZip()

    return zipEntries.map((entry) => {
      return {
        path: entry.entryName,
        data: entry.getData()
      }
    })
  }

  async fetchTests(owner: string, repo: string, runId: number, globs: string[]): Promise<Artifact[]> {
    // Skip if test file globs not provided
    if (globs.length < 1) return []

    return this.fetchArtifacts(owner, repo, runId, globs)
  }

  async fetchCustomReports(owner: string, repo: string, runId: number, customReportsConfigs: CustomReportConfig[]): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs.length < 1) return new Map()

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>()
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(owner, repo, runId, customReportConfig.paths)
      }
    })
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts)
    }

    return customReports
  }

  async fetchRepositoryTagMap (owner: string, repo: string): Promise<RepositoryTagMap> {
    try {
      const res = await this.octokit.repos.listTags({ owner, repo, per_page: 100 })
      const tags = res.data
      return new Map( tags.map((tag) => [tag.commit.sha, tag.name]) )
    }
    catch (error) {
      console.warn(`Failed to fetch ${owner}/${repo} tags.`)
      console.warn(`${owner}/${repo} can not include tag data into report.`)
      console.warn(error)
      return new Map()
    }
  }
}