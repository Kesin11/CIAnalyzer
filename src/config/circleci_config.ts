import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type CircleciConfig = CommonConfig & {
  repos: {
    vcsType: string
    owner: string
    repo: string
    fullname: string
    customReports: CustomReportConfig[]
  }[]
}

type RepoYaml = string | {
  name: string
  vcs_type?: string
  customReports?: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): CircleciConfig | undefined => {
  if (!config.circleci) return

  const circleciConfig = config.circleci

  // overwrite repos
  circleciConfig.repos = circleciConfig.repos.map((repoYaml: RepoYaml): CircleciConfig['repos'][0] => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      const vcsType = 'github'
      const fullname = `${vcsType}/${owner}/${repo}`
      return { vcsType, owner, repo, fullname, customReports: [] }
    }

    [owner, repo] = repoYaml.name.split('/')
    const vcsType = repoYaml.vcs_type ?? 'github'
    return {
      vcsType,
      owner,
      repo,
      fullname: `${vcsType}/${owner}/${repo}`,
      customReports: repoYaml.customReports ?? [],
    }
  })

  return circleciConfig as CircleciConfig
}
