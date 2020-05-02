import { loadConfig } from './config/config'
import { parseConfig } from './config/jenkins_config'
import { JenkinsClient } from './client/jenkins_client'

const main = async () => {
  const yamlConfig = loadConfig()
  const config = parseConfig(yamlConfig)

  if (!config) return

  const JENKINS_USER = process.env['JENKINS_USER']
  const JENKINS_TOKEN = process.env['JENKINS_TOKEN']
  const client = new JenkinsClient(config.baseUrl, JENKINS_USER, JENKINS_TOKEN)

  const jobs = await client.fetchWorkflowRuns()

  for (const job of jobs) {
    await client.fetchWorkflows(job.name)
  }

  await client.fetchJobs(jobs[0].name, 4)
}
main()