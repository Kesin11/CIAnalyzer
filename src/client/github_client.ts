import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'
import { CustomReportArtifact, Artifact } from './client'
import { minBy } from "lodash";
import { ZipExtractor } from "../zip_extractor";
import { CustomReportConfig } from "../config/config";
import { ArgumentOptions } from "../arg_options";

// Oktokit document: https://octokit.github.io/rest.js/v18#actions

const DEBUG_PER_PAGE = 10

export type WorkflowItem = RestEndpointMethodTypes['actions']['listRepoWorkflows']['response']['data']['workflows'][0]
type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listWorkflowRunsForRepo']['response']['data']['workflow_runs'][0]
// see: https://developer.github.com/v3/checks/runs/#create-a-check-run
type RunStatus = 'queued' | 'in_progress' | 'completed'

export type RepositoryTagMap = Map<string, string>

export class GithubClient {
  private octokit: Octokit
  constructor(token: string, private options: ArgumentOptions, baseUrl?: string) {
    const MyOctokit = Octokit.plugin(throttling, retry)
    this.octokit = new MyOctokit({
      auth: token,
      baseUrl: (baseUrl) ? baseUrl : 'https://api.github.com',
      log: (options.debug) ? console : undefined,
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          this.octokit.log.warn(
            `Request quota exhausted for request ${options.method} ${options.url}`
          )
          // Retry twice after hitting a rate limit error, then give up
          if (options.request.retryCount <= 2) {
            console.log(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onAbuseLimit: (retryAfter: number, options: any) => {
          // does not retry, only logs a warning
          this.octokit.log.warn(
            `Abuse detected for request ${options.method} ${options.url}`
          )
        },
      }
    })
  }

  // see: https://developer.github.com/v3/actions/workflow-runs/#list-repository-workflow-runs
  async fetchWorkflowRuns(owner: string, repo: string, workflowId: number, lastRunId?: number) {
    const runs = await this.octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      per_page: (this.options.debug) ? DEBUG_PER_PAGE : 100, // API default is 100
      // page: 1, // order desc
    })

    return this.filterWorkflowRuns(runs.data.workflow_runs, lastRunId)
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
      const response = this.octokit.actions.downloadArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
        archive_format: 'zip'
      })
      return { name: artifact.name, response }
    })

    // Unarchive zip artifacts
    const zipExtractor = new ZipExtractor()
    for (const { name, response } of nameResponse) {
      await zipExtractor.put(name, (await response).data as ArrayBuffer)
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