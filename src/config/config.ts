import fs from "node:fs";
import yaml from "js-yaml";
import type { Logger } from "tslog";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { bitriseYamlSchema } from "./bitrise_config.js";
import { circleciYamlSchema } from "./circleci_config.js";
import { githubYamlSchema } from "./github_config.js";
import { jenkinsYamlSchema } from "./jenkins_config.js";

const yamlSchema = z
  .object({
    github: githubYamlSchema.strict(),
    circleci: circleciYamlSchema.strict(),
    jenkins: jenkinsYamlSchema.strict(),
    bitrise: bitriseYamlSchema.strict(),
  })
  .partial();

// Don't export raw YamlConfig type to prevent accidental use
type YamlConfig = z.infer<typeof yamlSchema>;
// If other modules want to use the config, they should use ValidatedYamlConfig
export type ValidatedYamlConfig = YamlConfig & {
  _configValidated: true;
};

export const createJsonSchema = () => {
  return zodToJsonSchema(yamlSchema, "CIAnalyzer config schema");
};

export const loadConfig = (
  logger: Logger<unknown>,
  configPath: string,
): YamlConfig => {
  const config = yaml.load(fs.readFileSync(configPath, "utf8"));
  if (!config || typeof config !== "object")
    throw new Error(`Failed to load ${configPath} or config is not object`);

  logger.debug("Parsed config file:");
  logger.debug(JSON.stringify(config, null, 2));

  return config as YamlConfig;
};

// Remove _errors: [] in nested properties for human readability
const formatErrorForLog = (error: z.ZodError): string => {
  return JSON.stringify(
    error.format(),
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (key: any, value: any) => {
      return key === "_errors" && value.length === 0 ? undefined : value;
    },
    2,
  );
};

export const validateConfig = (
  logger: Logger<unknown>,
  config: YamlConfig,
  strict = false,
): ValidatedYamlConfig => {
  const parseResult = yamlSchema.safeParse(config);
  if (!parseResult.success) {
    if (strict === true) {
      throw new Error(
        `Invalid config. Formatted zod error:\n${formatErrorForLog(
          parseResult.error,
        )}`,
      );
    }
    logger.warn(
      "Invalid config. Formatted zod error:\n",
      formatErrorForLog(parseResult.error),
    );
  }
  return {
    ...config,
    _configValidated: true,
  };
};
