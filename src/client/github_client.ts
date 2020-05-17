import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { maxBy } from "lodash";

// Oktokit document: https://octokit.github.io/rest.js/v17#actions

const DEBUG_PER_PAGE = 10

type WorkflowRunsItem = RestEndpointMethodTypes['actions']['listRepoWorkflowRuns']['response']['data']['workflow_runs'][0]
// see: https://developer.github.com/v3/checks/runs/#create-a-check-run
type RunStatus = 'queued' | 'in_progress' | 'completed'

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
      per_page: (process.env['CI_ANALYZER_DEBUG']) ? DEBUG_PER_PAGE : 100, // API default is 100
      // page: 1, // order desc
    })

    const filterdWorkflowRuns = this.filterWorkflowRuns(runs.data.workflow_runs, fromRunId)

    // Attach workflow name
    return filterdWorkflowRuns.map((run) => {
      const workflowId = run.workflow_url.split('/').pop()! // parse workflow_url
      return {
        name: workflowIdMap.get(workflowId)!,
        run: run
      }
    })
  }

  filterWorkflowRuns (runs: WorkflowRunsItem[], fromRunId?: number): WorkflowRunsItem[] {
    const lastInprogress = maxBy(
      runs.filter((run) => run.status as RunStatus === 'in_progress'),
      (run) => run.run_number
    )
    // Filter to: fromRunId < Id < lastInprogressId
    runs = (fromRunId)
      ? runs.filter((run) => run.run_number > fromRunId)
      : runs
    runs = (lastInprogress)
      ? runs.filter((run) => run.run_number < lastInprogress.run_number)
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
}