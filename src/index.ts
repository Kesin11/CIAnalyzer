import { GithubClient } from './client/github_client'
import { GithubAnalyzer } from './analyzer/github_analyzer'

const main = async () => {
  const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
  const OWNER = 'Kesin11'
  const REPO = 'Firestore-simple'
  const githubClient = new GithubClient(GITHUB_TOKEN)

  const runs = await githubClient.fetchWorkflowRuns(OWNER, REPO)
  console.dir(runs)

  const jobs = await githubClient.fetchJobs(OWNER, REPO, runs[0].run.id)
  console.dir(jobs)


  const githubAnalyzer = new GithubAnalyzer()
  githubAnalyzer.createWorkflowReport(runs[0].name, runs[0].run, jobs)
}
main()