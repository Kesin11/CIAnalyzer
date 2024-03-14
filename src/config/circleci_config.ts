import { commonSchema, customReportSchema } from './schema.js'
import { ValidatedYamlConfig } from './config.js'
import { z } from 'zod'

export const circleciYamlSchema = commonSchema.merge(z.object({
  repos: z.union([z.string(), z.object({
    name: z.string(),
    vcs_type: z.string().optional(),
    customReports: customReportSchema.array().optional()
  })]).array(),
  vcsBaseUrl: z.object({
    github: z.string().optional()
  }).optional(),
  version: z.union([z.literal(1), z.literal(2)])
}))

const circleciSchema = circleciYamlSchema.merge(z.object({
  repos: z.object({
    vcsType: z.string(),
    owner: z.string(),
    repo: z.string(),
    fullname: z.string(),
    customReports: customReportSchema.array()
  }).array(),
}))
export type CircleciConfig = z.infer<typeof circleciSchema>

export const parseConfig = (config: ValidatedYamlConfig): CircleciConfig | undefined => {
  if (!config.circleci) return

  // overwrite repos and version
  const circleciConfig = {
    ...config.circleci,
    repos: (config.circleci.repos).map((repoYaml): CircleciConfig['repos'][0] => {
      let owner, repo
      if (typeof repoYaml === 'string') {
        [owner, repo] = repoYaml.split('/')
        const vcsType = 'github'
        const fullname = `${vcsType}/${owner}/${repo}`
        return { vcsType, owner, repo, fullname, customReports: [] }
      }

      [owner, repo] = repoYaml.name.split('/')
      const vcsType = repoYaml.vcs_type ?? 'github'
      return {
        vcsType,
        owner,
        repo,
        fullname: `${vcsType}/${owner}/${repo}`,
        customReports: repoYaml.customReports ?? [],
      }
    }),
    version: (String(config.circleci.version) === "2") ? 2 : 1
  } as CircleciConfig

  return circleciConfig
}
