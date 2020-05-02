import { ExporterConfig, YamlConfig } from './config'

export type JenkinsConfig = {
  baseUrl: string
  jobs: string[]
  exporter: ExporterConfig
}

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  const jenkinsConfig = config.jenkins
  return jenkinsConfig as JenkinsConfig
}
