import { loadConfig } from './config/config'
import { parseConfig } from './config/jenkins_config'
import { JenkinsClient } from './client/jenkins_client'
import { JenkinsAnalyzer } from './analyzer/jenkins_analyzer'

const main = async () => {
  const yamlConfig = loadConfig()
  const config = parseConfig(yamlConfig)

  if (!config) return

  const JENKINS_USER = process.env['JENKINS_USER']
  const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
  const client = new JenkinsClient(config.baseUrl, JENKINS_USER, JENKINS_TOKEN)
  const analyzer = new JenkinsAnalyzer()

  const allJobs = await client.fetchWorkflowRuns()
  const jobs = allJobs.filter((job) => config.jobs.includes(job.name))

  for (const job of jobs) {
    const builds = await client.fetchWorkflows(job)
    for (const build of builds) {
      const report = analyzer.createWorkflowReport(job.name, build)
      // console.dir(report)
      console.log(JSON.stringify(report, null, 2))
    }
  }

  // await client.fetchJobs(jobs[0].name, 4)
}
main()