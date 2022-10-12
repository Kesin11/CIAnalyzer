import { YamlConfig, customReportSchema, commonSchema } from './config'
import { z } from 'zod'

const jenkinsConfigJobSchema = z.object({
  name: z.string(),
  testGlob: z.string().array(),
  customReports: customReportSchema.array()
})
export type JenkinsConfigJob = z.infer<typeof jenkinsConfigJobSchema>

const jenkinsConfigSchema = commonSchema.merge(z.object({
  baseUrl: z.string(),
  jobs: jenkinsConfigJobSchema.array(),
  correctAllJobs: z.object({
    filterLastBuildDay: z.number().optional(),
    isRecursively: z.boolean().optional()
  }).optional()
}))
export type JenkinsConfig = z.infer<typeof jenkinsConfigSchema>

const repoYamlSchema = z.union([z.string(), z.object({
  name: z.string(),
  tests: z.string().array().optional(),
  customReports: customReportSchema.array().optional()
})])
type JobYaml = z.infer<typeof repoYamlSchema>

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  const jenkinsConfig = { ...config.jenkins }
  // overwrite jobs
  jenkinsConfig.jobs = (jenkinsConfig.jobs as JobYaml[]).map((jobYaml): JenkinsConfig['jobs'][0] => {
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
