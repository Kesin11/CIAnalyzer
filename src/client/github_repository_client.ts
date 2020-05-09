import { Octokit } from "@octokit/rest";
export type RepositoryTagMap = Map<string, string>

export class GithubRepositoryClient {
  private octokit: Octokit
  private baseUrl: string
  constructor(token: string, baseUrl?: string) {
    this.baseUrl = baseUrl ?? 'https://api.github.com'
    this.octokit = new Octokit({
      auth: token,
      baseUrl: this.baseUrl,
      log: (process.env['CI_ANALYZER_DEBUG']) ? console : undefined,
    })
  }

  async fetchRepositoryTagMap (owner: string, repo: string): Promise<RepositoryTagMap> {
    try {
      const res = await this.octokit.repos.listTags({ owner, repo, per_page: 100 })
      const tags = res.data
      return new Map( tags.map((tag) => [tag.commit.sha, tag.name]) )
    }
    catch (error) {
      console.warn(`Failed to fetch ${owner}/${repo} tags from ${this.baseUrl}`)
      console.warn(`${owner}/${repo} can not include tag data into report.`)
      console.warn(error)
      return new Map()
    }
  }
}