import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type CircleciConfig = CommonConfig & {
  repos: {
    vscType: string
    owner: string
    repo: string
    fullname: string
    customReports: CustomReportConfig[]
  }[]
}

type RepoYaml = string | {
  name: string
  vsc_type: string
  customReports: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): CircleciConfig | undefined => {
  if (!config.circleci) return

  const circleciConfig = config.circleci

  // overwrite repos
  circleciConfig.repos = circleciConfig.repos.map((repoYaml: RepoYaml) => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      const vscType = 'github'
      const fullname = `${vscType}/${owner}/${repo}`
      return { vscType, owner, repo, fullname }
    }

    [owner, repo] = repoYaml.name.split('/')
    const vscType = repoYaml.vsc_type ?? 'github'
    return {
      vscType,
      owner,
      repo,
      fullname: `${vscType}/${owner}/${repo}`,
      customReports: repoYaml.customReports,
    }
  })

  return circleciConfig as CircleciConfig
}
