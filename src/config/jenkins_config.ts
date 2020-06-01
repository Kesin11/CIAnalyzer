import { YamlConfig, CommonConfig } from './config'

export type JenkinsConfig = CommonConfig & {
  baseUrl: string
  jobs: {
    name: string
    testGlob: string[]
  }[]
}

type JobYaml = string | {
  name: string
  tests: string[]
}

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  const jenkinsConfig = config.jenkins
  // overwrite jobs
  jenkinsConfig.jobs = jenkinsConfig.jobs.map((jobYaml: JobYaml) => {
    if (typeof jobYaml === 'string') {
      return { name: jobYaml, testGlob: [] }
    }

    return {
      name: jobYaml.name,
      testGlob: jobYaml.tests
    }
  })

  return jenkinsConfig as JenkinsConfig
}
