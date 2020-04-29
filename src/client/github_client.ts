import { Octokit } from "@octokit/rest";

export class GithubClient {
  private octokit: Octokit
  constructor(token: string, baseUrl?: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: (baseUrl) ? baseUrl : 'https://api.github.com',
    })
  }

  async fetchWorkflows(owner: string, repo: string, fromRunId?: number) {
    // TODO: loop and increment page while found fromRunId
    const runs = await this.octokit.actions.listRepoWorkflowRuns({
      owner,
      repo,
      // per_page: 100, // default
      // page: 1, // order desc
    })

    const workflowRuns = runs.data.workflow_runs
    return (fromRunId)
      ? workflowRuns.filter((run) => run.id > fromRunId)
      : workflowRuns
  }

  async fetchJobs(owner: string, repo: string, runId: number) {
    const jobs = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId
    })
    return jobs.data.jobs
  }
}