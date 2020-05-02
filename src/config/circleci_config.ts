import { ExporterConfig, YamlConfig } from './config'

type RepoYaml = string | {
  name: string
  vsc_type: string
}

type CircleciYaml = {
  baseUrl?: string
  repos: RepoYaml[]
  exporter: ExporterConfig
}

export type CircleciConfig = {
  baseUrl?: string
  repos: {
    vscType: string
    owner: string
    repo: string
  }[]
  exporter: ExporterConfig
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
      return { vscType, owner, repo }
    }
    else {
      const vscType = repoNameOrObj.vsc_type ?? 'github'
      const [owner, repo] = repoNameOrObj.name.split('/')
      return { vscType, owner, repo }
    }
  })
}
