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

  const allJobs = await client.fetchJobs()
  const jobs = allJobs.filter((job) => config.jobs.includes(job.name))

  for (const job of jobs) {
    const runs = await client.fetchJobRuns(job)
    for (const run of runs) {
      const build = await client.fetchBuild(job, Number(run.id))
      const report = analyzer.createWorkflowReport(job.name, run, build)

      console.dir(report)
      // console.log(JSON.stringify(report, null, 2))
    }
  }

  // await client.fetchJobs(jobs[0].name, 4)
}
main()