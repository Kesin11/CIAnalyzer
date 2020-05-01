import { GithubClient } from './client/github_client'
import { GithubAnalyzer } from './analyzer/github_analyzer'
import { loadConfig } from './config/github_config'
import { WorkflowReport } from './analyzer/analyzer'
import { CompositExporter } from './exporter/exporter'

const main = async () => {
  const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
  const githubClient = new GithubClient(GITHUB_TOKEN)
  const githubAnalyzer = new GithubAnalyzer()
  const githubConfig = loadConfig()
  if (!githubConfig) return

  const reports: WorkflowReport[] = []
  for (const repo of githubConfig.repos) {
    const workflowRuns = await githubClient.fetchWorkflowRuns(repo.owner, repo.repo)
    for (const workflowRun of workflowRuns) {
      const jobs = await githubClient.fetchJobs(repo.owner, repo.repo, workflowRun.run.id)
      const report = githubAnalyzer.createWorkflowReport(workflowRun.name, workflowRun.run, jobs)

      reports.push(report)
    }
  }

  const exporter = new CompositExporter('github', githubConfig.exporter)
  await exporter.exportReports(reports)
}
main()