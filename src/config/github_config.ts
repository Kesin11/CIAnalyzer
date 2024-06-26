import { commonSchema, customReportSchema } from "./schema.js";
import type { ValidatedYamlConfig } from "./config.js";
import { z } from "zod";

export const githubYamlSchema = commonSchema.merge(
  z.object({
    repos: z
      .union([
        z.string(),
        z.object({
          name: z.string(),
          tests: z.string().array().optional(),
          customReports: customReportSchema.array().optional(),
        }),
      ])
      .array(),
  }),
);

const githubSchema = githubYamlSchema.merge(
  z.object({
    repos: z
      .object({
        owner: z.string(),
        repo: z.string(),
        fullname: z.string(),
        testGlob: z.string().array(),
        customReports: customReportSchema.array(),
      })
      .array(),
  }),
);
export type GithubConfig = z.infer<typeof githubSchema>;

export const parseConfig = (
  config: ValidatedYamlConfig,
): GithubConfig | undefined => {
  if (!config.github) return;

  // overwrite repos
  const githubConfig = {
    ...config.github,
    repos: config.github.repos.map((repoYaml): GithubConfig["repos"][0] => {
      let owner: string;
      let repo: string;
      if (typeof repoYaml === "string") {
        [owner, repo] = repoYaml.split("/");
        return {
          owner,
          repo,
          fullname: repoYaml,
          testGlob: [],
          customReports: [],
        };
      }

      [owner, repo] = repoYaml.name.split("/");
      return {
        owner,
        repo,
        fullname: repoYaml.name,
        testGlob: repoYaml.tests ?? [],
        customReports: repoYaml.customReports ?? [],
      };
    }),
  } as GithubConfig;

  return githubConfig;
};
