import { YamlConfig, CommonConfig, CustomReportConfig } from './config'

export type JenkinsConfig = CommonConfig & {
  baseUrl: string
  jobs: {
    name: string
    testGlob: string[]
    customReports: CustomReportConfig[]
  }[]
}

type JobYaml = string | {
  name: string
  tests: string[]
  customReports: CustomReportConfig[]
}

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  const jenkinsConfig = config.jenkins
  // overwrite jobs
  jenkinsConfig.jobs = jenkinsConfig.jobs.map((jobYaml: JobYaml) => {
    if (typeof jobYaml === 'string') {
      return { name: jobYaml, testGlob: [], customReports: [] }
    }

    return {
      name: jobYaml.name,
      testGlob: jobYaml.tests ?? [],
      customReports: jobYaml.customReports ?? []
    }
  })

  return jenkinsConfig as JenkinsConfig
}
