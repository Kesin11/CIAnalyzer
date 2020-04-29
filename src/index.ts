import { GithubClient } from './client/github_client'
import { GithubAnalyzer } from './analyzer/github_analyzer'
import { loadConfig } from './config/github_config'

const main = async () => {
  const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
  const githubClient = new GithubClient(GITHUB_TOKEN)
  const githubAnalyzer = new GithubAnalyzer()
  const githubConfig = loadConfig()
  if (!githubConfig) return

  for (const repo of githubConfig.repos) {
    const workflowRuns = await githubClient.fetchWorkflowRuns(repo.owner, repo.repo)
    for (const workflowRun of workflowRuns) {
      const jobs = await githubClient.fetchJobs(repo.owner, repo.repo, workflowRun.run.id)
      const report = githubAnalyzer.createWorkflowReport(workflowRun.name, workflowRun.run, jobs)

      console.dir(report)
    }
  }
}
main()