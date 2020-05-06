import { Octokit } from "@octokit/rest";

const DEBUG_PER_PAGE = 10

export class GithubClient {
  private octokit: Octokit
  constructor(token: string, baseUrl?: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: (baseUrl) ? baseUrl : 'https://api.github.com',
      log: (process.env['CI_ANALYZER_DEBUG']) ? console : undefined,
    })
  }

  // see: https://developer.github.com/v3/actions/workflow-runs/#list-repository-workflow-runs
  async fetchWorkflowRuns(owner: string, repo: string, fromRunId?: number) {
    const workflows = await this.fetchWorkflows(owner, repo)
    const workflowIdMap = new Map((
      workflows.map((workflow) => [String(workflow.id), workflow.name])
    ))

    const runs = await this.octokit.actions.listRepoWorkflowRuns({
      owner,
      repo,
      status: "completed",
      per_page: (process.env['CI_ANALYZER_DEBUG']) ? DEBUG_PER_PAGE : 100, // API default is 100
      // page: 1, // order desc
    })

    // Attach workflow name
    const workflowRuns = runs.data.workflow_runs.map((run) => {
      const workflowId = run.workflow_url.split('/').pop()! // parse workflow_url
      return {
        name: workflowIdMap.get(workflowId)!,
        run: run
      }
    })

    return (fromRunId)
      ? workflowRuns.filter((workflowRun) => workflowRun.run.run_number > fromRunId)
      : workflowRuns
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
}