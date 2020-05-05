import { YamlConfig, CommonConfig } from './config'

export type GithubConfig = CommonConfig & {
  baseUrl?: string
  repos: {
    owner: string
    repo: string
  }[]
}

export const parseConfig = (config: YamlConfig): GithubConfig | undefined => {
  if (!config.github) return

  const githubConfig = config.github
  // overwrite repos
  githubConfig.repos = githubConfig.repos.map((repoFullname: string) => {
    const [owner, repo] = repoFullname.split('/')
    return { owner, repo }
  })

  return githubConfig as GithubConfig
}
