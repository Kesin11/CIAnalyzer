import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type BitriseConfig = CommonConfig & {
  apps: {
    owner: string
    title: string
    fullname: string
    testGlob: string[]
    customReports: CustomReportConfig[]
  }[]
}

type AppYaml = string | {
  name: string
  tests?: string[]
  customReports?: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): BitriseConfig | undefined => {
  if (!config.bitrise) return

  const bitriseConfig = config.bitrise

  // overwrite repos
  bitriseConfig.apps = bitriseConfig.apps.map((appYaml: AppYaml): BitriseConfig['apps'][0] => {
    let owner, title
    if (typeof appYaml === 'string') {
      [owner, title] = appYaml.split('/')
      return {
        owner,
        title,
        fullname: appYaml,
        testGlob: [],
        customReports: []
      }
    }

    [owner, title] = appYaml.name.split('/')
    return {
      owner,
      title,
      fullname: appYaml.name,
      testGlob: appYaml.tests ?? [],
      customReports: appYaml.customReports ?? [],
    }
  })

  return bitriseConfig as BitriseConfig
}
