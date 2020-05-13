import { maxBy } from "lodash"
import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { CircleciClient } from "../client/circleci_client"
import { CircleciAnalyzer } from "../analyzer/circleci_analyzer"
import { CircleciConfig, parseConfig } from "../config/circleci_config"
import { WorkflowReport } from "../analyzer/analyzer"
import { CompositExporter } from "../exporter/exporter"
import { LastRunStore } from "../last_run_store"
import { GithubRepositoryClient } from "../client/github_repository_client"

export class CircleciRunner implements Runner {
  service: string = 'circleci'
  client: CircleciClient
  analyzer: CircleciAnalyzer 
  config: CircleciConfig | undefined
  store?: LastRunStore
  repoClient: GithubRepositoryClient
  constructor(public yamlConfig: YamlConfig) {
    const CIRCLECI_TOKEN = process.env['CIRCLECI_TOKEN'] || ''
    this.config = parseConfig(yamlConfig)
    this.client = new CircleciClient(CIRCLECI_TOKEN, this.config?.baseUrl)
    this.analyzer = new CircleciAnalyzer()

    const GITHUB_TOKEN = process.env['GITHUB_TOKEN'] || ''
    this.repoClient = new GithubRepositoryClient(GITHUB_TOKEN, this.config?.vscBaseUrl?.github)
  }

  private setRepoLastRun(reponame: string, reports: WorkflowReport[]) {
    const lastRunReport = maxBy(reports, 'buildNumber')
    if (lastRunReport) {
      this.store?.setLastRun(reponame, lastRunReport.buildNumber)
    }
  }

  async run () {
    if (!this.config) return
    this.store = await LastRunStore.init(this.service, this.config?.lastRunStore)

    let reports: WorkflowReport[] = []
    for (const repo of this.config.repos) {
      console.info(`Fetching ${this.service} - ${repo.fullname} ...`)
      const repoReports: WorkflowReport[] = []

      try {
        const fromRunId = this.store.getLastRun(repo.fullname)
        const workflowRuns = await this.client.fetchWorkflowRuns(repo.owner, repo.repo, repo.vscType, fromRunId)
        const tagMap = await this.repoClient.fetchRepositoryTagMap(repo.owner, repo.repo)

        for (const workflowRun of workflowRuns) {
          const jobs = await Promise.all(workflowRun.build_nums.map((buildNum) => {
            return this.client.fetchJobs(
              workflowRun.username,
              workflowRun.reponame,
              workflowRun.vcs_type,
              buildNum
              )
          }))
          const report = this.analyzer.createWorkflowReport(workflowRun, jobs, tagMap)

          repoReports.push(report)
        }

        this.setRepoLastRun(repo.fullname, repoReports)
        reports = reports.concat(repoReports)
      }
      catch (error) {
        console.error(`Some error raised in '${repo.fullname}', so it skipped.`)
        console.error(error)
        continue
      }
    }

    console.info(`Exporting ${this.service} workflow reports ...`)
    const exporter = new CompositExporter(this.service, this.config.exporter)
    await exporter.exportReports(reports)

    this.store.save()
    console.info(`Success: done execute '${this.service}'`)
  }
}
