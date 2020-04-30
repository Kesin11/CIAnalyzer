import { loadConfig } from './config/circleci_config'
import { CircleciClient } from './client/circleci_client'
import { CircleciAnalyzer } from './analyzer/circleci_analyzer'

const main = async () => {
  const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
  const config = loadConfig()
  if (!config) return

  const client = new CircleciClient(CIRCLECI_TOKEN, config.baseUrl)
  const circleciAnalyzer = new CircleciAnalyzer()
  for (const repo of config.repos) {
    const workflowRuns = await client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vscType)
    for (const workflowRun of workflowRuns) {
      const jobs = await Promise.all(workflowRun.build_nums.map((buildNum) => {
        return client.fetchJobs(
          workflowRun.username,
          workflowRun.reponame,
          workflowRun.vcs_type,
          buildNum
          )
      }))
      const report = circleciAnalyzer.createWorkflowReport(workflowRun, jobs)
      // console.dir(report)
      console.log(JSON.stringify(report, null, 2))
    }
  }
}
main()