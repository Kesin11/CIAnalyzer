import { commonSchema, customReportSchema } from './schema.js'
import type { ValidatedYamlConfig } from "./config.js"
import { z } from 'zod'

export const bitriseYamlSchema = commonSchema.merge(z.object({
  apps: z.union([z.string(), z.object({
    name: z.string(),
    tests: z.string().array().optional(),
    customReports: customReportSchema.array().optional()
  })]).array()
}))

const bitriseSchema = bitriseYamlSchema.merge(z.object({
  apps: z.object({
    owner: z.string(),
    title: z.string(),
    fullname: z.string(),
    testGlob: z.string().array(),
    customReports: customReportSchema.array()
  }).array()
}))
export type BitriseConfig = z.infer<typeof bitriseSchema >

export const parseConfig = (config: ValidatedYamlConfig): BitriseConfig | undefined => {
  if (!config.bitrise) return

  // overwrite repos
  const bitriseConfig = {
    ...config.bitrise,
    apps: (config.bitrise.apps).map((appYaml): BitriseConfig['apps'][0] => {
      let owner
      let title
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
  } as BitriseConfig

  return bitriseConfig
}
