import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type BitriseConfig = CommonConfig & {
  repos: {
    owner: string
    repo: string
    fullname: string
    slug?: string
    testGlob: string[]
    customReports: CustomReportConfig[]
  }[]
}

type RepoYaml = string | {
  name: string
  slug?: string
  tests?: string[]
  customReports?: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): BitriseConfig | undefined => {
  if (!config.bitrise) return

  const bitriseConfig = config.bitrise

  // overwrite repos
  bitriseConfig.repos = bitriseConfig.repos.map((repoYaml: RepoYaml): BitriseConfig['repos'][0] => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      return {
        owner,
        repo,
        fullname: repoYaml,
        slug: undefined,
        testGlob: [],
        customReports: []
      }
    }

    [owner, repo] = repoYaml.name.split('/')
    return {
      owner,
      repo,
      fullname: repoYaml.name,
      slug: repoYaml.slug ?? undefined,
      testGlob: repoYaml.tests ?? [],
      customReports: repoYaml.customReports ?? [],
    }
  })

  return bitriseConfig as BitriseConfig
}
