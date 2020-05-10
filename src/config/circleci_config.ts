import { YamlConfig, CommonConfig } from './config'

type RepoYaml = string | {
  name: string
  vsc_type: string
}

type CircleciYaml = CommonConfig & {
  baseUrl?: string
  repos: RepoYaml[]
}

export type CircleciConfig = CommonConfig & {
  baseUrl?: string
  repos: {
    vscType: string
    owner: string
    repo: string
    fullname: string
  }[]
}

export const parseConfig = (config: YamlConfig): CircleciConfig | undefined => {
  if (!config.circleci) return

  const circleciYaml = config.circleci as CircleciYaml
  const repos = parseRepos(circleciYaml.repos)

  return {
    ...circleciYaml,
    repos
  }
}

const parseRepos = (repos: RepoYaml[]): CircleciConfig['repos'] => {
  return repos.map((repoNameOrObj) => {
    if (typeof repoNameOrObj === 'string') {
      const vscType = 'github'
      const [owner, repo] = repoNameOrObj.split('/')
      const fullname = `${vscType}/${owner}/${repo}`
      return { vscType, owner, repo, fullname }
    }
    else {
      const vscType = repoNameOrObj.vsc_type ?? 'github'
      const [owner, repo] = repoNameOrObj.name.split('/')
      const fullname = `${vscType}/${owner}/${repo}`
      return { vscType, owner, repo, fullname }
    }
  })
}
