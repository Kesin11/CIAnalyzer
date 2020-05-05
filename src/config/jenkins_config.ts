import { YamlConfig, CommonConfig } from './config'

export type JenkinsConfig = CommonConfig & {
  baseUrl: string
  jobs: string[]
}

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  const jenkinsConfig = config.jenkins
  return jenkinsConfig as JenkinsConfig
}
