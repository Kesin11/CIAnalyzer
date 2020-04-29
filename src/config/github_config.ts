import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

type GithubConfig = {
  baseUrl?: string
  repos: {
    owner: string
    repo: string
  }[]
}

const defaultPath = path.join(__dirname, '../../ci_analyzer.yaml')

export const loadConfig = (configPath?: string): GithubConfig | undefined => {
  configPath = configPath || defaultPath

  const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))
  if (!config.github) return

  const githubConfig = config.github
  githubConfig.repos = githubConfig.repos.map((repoFullname: string) => {
    const [owner, repo] = repoFullname.split('/')
    return { owner, repo }
  })

  return githubConfig as GithubConfig
}