import { YamlConfig, commonSchema, customReportSchema } from './config'
import { z } from 'zod'

const githubSchema = commonSchema.merge(z.object({
  repos: z.object({
    owner: z.string(),
    repo: z.string(),
    fullname: z.string(),
    testGlob: z.string().array(),
    customReports: customReportSchema.array()
  }).array()
}))
export type GithubConfig = z.infer<typeof githubSchema>

const repoYamlSchema = z.union([z.string(), z.object({
  name: z.string(),
  tests: z.string().array().optional(),
  customReports: customReportSchema.array().optional()
})])
type RepoYaml = z.infer<typeof repoYamlSchema>

export const parseConfig = (config: YamlConfig): GithubConfig | undefined => {
  if (!config.github) return

  const githubConfig = { ...config.github }
  // overwrite repos
  githubConfig.repos = (githubConfig.repos as RepoYaml[]).map((repoYaml): GithubConfig['repos'][0] => {
    let owner, repo
    if (typeof repoYaml === 'string') {
      [owner, repo] = repoYaml.split('/')
      return { owner, repo, fullname: repoYaml, testGlob: [], customReports: [] }
    }

    [owner, repo] = repoYaml.name.split('/')
    return {
      owner,
      repo,
      fullname: repoYaml.name,
      testGlob: repoYaml.tests ?? [],
      customReports: repoYaml.customReports ?? [],
    }
  })

  return githubConfig as GithubConfig
}
