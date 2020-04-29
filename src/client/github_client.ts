import { Octokit } from "@octokit/rest";

export class GithubClient {
  private octokit: Octokit
  constructor(token: string, baseUrl?: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: (baseUrl) ? baseUrl : 'https://api.github.com',
    })
  }

  async fetchWorkflowRuns(owner: string, repo: string, fromRunId?: number) {
    // TODO: loop and increment page while found fromRunId
    const runs = await this.octokit.actions.listRepoWorkflowRuns({
      owner,
      repo,
      status: "completed",
      // per_page: 100, // default
      // page: 1, // order desc
    })

    const workflows = await this.fetchWorkflows(owner, repo)
    const workflowIdMap = new Map((
      workflows.map((workflow) => [String(workflow.id), workflow.name])
    ))

    // Attach workflow name
    const workflowRuns = runs.data.workflow_runs.map((run) => {
      const workflowId = run.workflow_url.split('/').pop()! // parse workflow_url
      return {
        name: workflowIdMap.get(workflowId)!,
        run: run
      }
    })

    return (fromRunId)
      ? workflowRuns.filter((workflowRun) => workflowRun.run.id > fromRunId)
      : workflowRuns
  }

  async fetchWorkflows(owner: string, repo: string) {
    const workflows = await this.octokit.actions.listRepoWorkflows({
      owner,
      repo,
    })

    return workflows.data.workflows
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