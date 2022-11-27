import { YamlConfig, commonSchema, customReportSchema } from './config'
import { z } from 'zod'

const bitriseSchema = commonSchema.merge(z.object({
  apps: z.object({
    owner: z.string(),
    title: z.string(),
    fullname: z.string(),
    testGlob: z.string().array(),
    customReports: customReportSchema.array()
  }).array()
}))
export type BitriseConfig = z.infer<typeof bitriseSchema >

const appYamlSchema = z.union([z.string(), z.object({
  name: z.string(),
  tests: z.string().array().optional(),
  customReports: customReportSchema.array()
})])
type AppYaml = z.infer<typeof appYamlSchema>

export const parseConfig = (config: YamlConfig): BitriseConfig | undefined => {
  if (!config.bitrise) return

  const bitriseConfig = { ...config.bitrise }

  // overwrite repos
  bitriseConfig.apps = (bitriseConfig.apps as AppYaml[]).map((appYaml): BitriseConfig['apps'][0] => {
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
