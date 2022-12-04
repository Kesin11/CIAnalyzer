import { customReportSchema, commonSchema } from './config'
import { YamlConfig } from "./validator"
import { z } from 'zod'

export const jenkinsYamlSchema = commonSchema.merge(z.object({
  baseUrl: z.string(),
  jobs: z.union([z.string(), z.object({
    name: z.string(),
    tests: z.string().array().optional(),
    customReports: customReportSchema.array().optional()
  })]).array(),
  correctAllJobs: z.object({
    filterLastBuildDay: z.number().optional(),
    isRecursively: z.boolean().optional()
  }).optional()
}))

const jenkinsConfigSchema = jenkinsYamlSchema.merge(z.object({
  jobs: z.object({
    name: z.string(),
    testGlob: z.string().array(),
    customReports: customReportSchema.array()
  }).array()
}))
export type JenkinsConfig = z.infer<typeof jenkinsConfigSchema>

export const parseConfig = (config: YamlConfig): JenkinsConfig | undefined => {
  if (!config.jenkins) return

  // overwrite jobs
  const jenkinsConfig = {
    ...config.jenkins,
    jobs: (config.jenkins.jobs).map((jobYaml): JenkinsConfig['jobs'][0] => {
      if (typeof jobYaml === 'string') {
        return { name: jobYaml, testGlob: [], customReports: [] }
      }

      return {
        name: jobYaml.name,
        testGlob: jobYaml.tests ?? [],
        customReports: jobYaml.customReports ?? []
      }
    })
  } as JenkinsConfig

  return jenkinsConfig
}
