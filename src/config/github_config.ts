import { YamlConfig, CommonConfig } from './config'

export type GithubConfig = CommonConfig & {
  baseUrl?: string
  repos: {
    owner: string
    repo: string
    fullname: string
  }[]
}

export const parseConfig = (config: YamlConfig): GithubConfig | undefined => {
  if (!config.github) return

  const githubConfig = config.github
  // overwrite repos
  githubConfig.repos = githubConfig.repos.map((fullname: string) => {
    const [owner, repo] = fullname.split('/')
    return { owner, repo, fullname }
  })

  return githubConfig as GithubConfig
}
