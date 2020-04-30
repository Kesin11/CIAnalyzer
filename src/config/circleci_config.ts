import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

type RepoYaml = string | {
  name: string
  vsc_type: string
}

type CircleciYaml = {
  baseUrl?: string
  repos: RepoYaml[]
}
type CircleciConfig = {
  baseUrl?: string
  repos: {
    vscType: string
    owner: string
    repo: string
  }[]
}

const defaultPath = path.join(__dirname, '../../ci_analyzer.yaml')

export const loadConfig = (configPath?: string): CircleciConfig | undefined => {
  configPath = configPath || defaultPath

  const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))
  if (!config.circleci) return

  const circleciYaml = config.circleci as CircleciYaml
  const repos = parseRepos(circleciYaml.repos)

  return {
    baseUrl: circleciYaml.baseUrl,
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