import { YamlConfig, commonSchema, customReportSchema } from './config'
import { z } from 'zod'

const circleciSchema = commonSchema.merge(z.object({
  repos: z.object({
    vcsType: z.string(),
    owner: z.string(),
    repo: z.string(),
    fullname: z.string(),
    customReports: customReportSchema.array()
  }).array(),
  vcsBaseUrl: z.object({
    github: z.string().optional()
  }).optional(),
  version: z.union([z.literal(1), z.literal(2)])
}))
export type CircleciConfig = z.infer<typeof circleciSchema>

const repoYamlSchema = z.union([z.string(), z.object({
  name: z.string(),
  vcs_type: z.string().optional(),
  customReports: customReportSchema.array().optional()
})])
type RepoYaml = z.infer<typeof repoYamlSchema>

export const parseConfig = (config: YamlConfig): CircleciConfig | undefined => {
  if (!config.circleci) return

  const circleciConfig = { ...config.circleci }

  circleciConfig.version = (String(circleciConfig.version) === "2") ? 2 : 1

  // overwrite repos
  circleciConfig.repos = (circleciConfig.repos as RepoYaml[]).map((repoYaml): CircleciConfig['repos'][0] => {
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
  })

  return circleciConfig as CircleciConfig
}
