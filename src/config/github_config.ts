import { YamlConfig, CommonConfig } from './config'

export type GithubConfig = CommonConfig & {
  repos: {
    owner: string
    repo: string
    fullname: string
    testGlob: string[]
  }[]
}

type RepoYaml = string | {
  name: string
  tests: string[]
}

export const parseConfig = (config: YamlConfig): GithubConfig | undefined => {
  if (!config.github) return

  const githubConfig = config.github
  // overwrite repos
  githubConfig.repos = githubConfig.repos.map((repoYaml: RepoYaml) => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      return { owner, repo, fullname: repoYaml, testGlob: [] }
    }

    [owner, repo] = repoYaml.name.split('/')
    return {
      owner,
      repo,
      fullname: repoYaml.name,
      testGlob: repoYaml.tests
    }
  })

  return githubConfig as GithubConfig
}
