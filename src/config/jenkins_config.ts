import { customReportSchema, commonSchema } from './schema.js'
import { ValidatedYamlConfig } from './config.js'
import { z } from 'zod'
import { Logger } from 'tslog'

export const jenkinsYamlSchema = commonSchema.merge(z.object({
  baseUrl: z.string(),
  jobs: z.union([z.string(), z.object({
    name: z.string(),
    tests: z.string().array().optional(),
    customReports: customReportSchema.array().optional()
  })]).array(),
  // NOTE: It is deprecated key and will be removed
  correctAllJobs: z.object({
    filterLastBuildDay: z.number().optional(),
    isRecursively: z.boolean().optional()
  }).optional(),
  collectAllJobs: z.object({
    filterLastBuildDay: z.number().optional(),
    isRecursively: z.boolean().optional()
  }).optional()
}))
type JenkinsYaml = z.infer<typeof jenkinsYamlSchema>

const jenkinsConfigSchema = jenkinsYamlSchema.merge(z.object({
  jobs: z.object({
    name: z.string(),
    testGlob: z.string().array(),
    customReports: customReportSchema.array()
  }).array()
})).omit({ // Omit deprecated keys
  correctAllJobs: true
})
export type JenkinsConfig = z.infer<typeof jenkinsConfigSchema>

export const parseConfig = (config: ValidatedYamlConfig, logger: Logger<unknown>): JenkinsConfig | undefined => {
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
  }

  return migrateConfig(jenkinsConfig, logger)
}

const migrateConfig = (config: JenkinsYaml , logger: Logger<unknown>): JenkinsConfig => {
  const migrated = structuredClone(config)

  if (config.correctAllJobs) {
    logger.warn('`correctAllJobs` is deprecated. Please use collectAllJobs instead.')
    migrated.collectAllJobs = config.correctAllJobs
    delete migrated.correctAllJobs
  }

  return migrated as JenkinsConfig
}
