import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type GithubConfig = CommonConfig & {
  repos: {
    owner: string
    repo: string
    fullname: string
    testGlob: string[]
    customReports: CustomReportConfig[]
  }[]
}

type RepoYaml = string | {
  name: string
  tests?: string[]
  customReports?: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): GithubConfig | undefined => {
  if (!config.github) return

  const githubConfig = config.github
  // overwrite repos
  githubConfig.repos = githubConfig.repos.map((repoYaml: RepoYaml): GithubConfig['repos'][0] => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      return { owner, repo, fullname: repoYaml, testGlob: [], customReports: [] }
    }

    [owner, repo] = repoYaml.name.split('/')
    return {
      owner,
      repo,
      fullname: repoYaml.name,
      testGlob: repoYaml.tests ?? [],
      customReports: repoYaml.customReports ?? [],
    }
  })

  return githubConfig as GithubConfig
}
