import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import axios, { AxiosInstance } from 'axios'
import { axiosRequestLogger } from './client'
import { minBy } from "lodash";
import { ArtifactExtractor } from "../artifact_extractor";

// Oktokit document: https://octokit.github.io/rest.js/v17#actions

const DEBUG_PER_PAGE = 10

type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listRepoWorkflowRuns']['response']['data']['workflow_runs'][0]
// see: https://developer.github.com/v3/checks/runs/#create-a-check-run
type RunStatus = 'queued' | 'in_progress' | 'completed'

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
      timeout: 1000,
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

    const runs = await this.octokit.actions.listRepoWorkflowRuns({
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

  async fetchArtifacts(owner: string, repo: string, runId: number) {
    const res = await this.octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: runId
    })
    return res.data.artifacts
  }

  async fetchTests(owner: string, repo: string, runId: number, globs: string[]) {
    // Skip if test file globs not provided
    if (globs.length < 1) return []

    const artifacts = await this.fetchArtifacts(owner, repo, runId)

    const artifactsExtractor = new ArtifactExtractor()
    for (const artifact of artifacts) {
      const res = await this.axios.get(
        artifact.archive_download_url,
        { responseType: 'arraybuffer'}
      )
      await artifactsExtractor.put(artifact.name, res.data)
    }

    const tests = await artifactsExtractor.extract(globs)
    await artifactsExtractor.rmTmpZip()
    return tests
  }
}