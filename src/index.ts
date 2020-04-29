import { Octokit } from '@octokit/rest'

const main = async () => {
  const GITHUB_TOKEN = process.env['GITHUB_TOKEN']
  const octokit = new Octokit({
    auth: GITHUB_TOKEN
  })

  const runs = await octokit.actions.listRepoWorkflowRuns({
    owner: 'Kesin11',
    repo: 'Firestore-simple',
    // per_page: 100, // default
    // page: 1, // order desc
  })
  console.log(runs.data.workflow_runs[0])

  const runId = runs.data.workflow_runs[0].id

  const jobs = await octokit.actions.listJobsForWorkflowRun({
    owner: 'Kesin11',
    repo: 'Firestore-simple',
    run_id: runId
  })
  console.dir(jobs.data.jobs[0])
}
main()