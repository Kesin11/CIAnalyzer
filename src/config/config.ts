import fs from "node:fs";
import { load as yamlLoad } from "js-yaml";
import type { Logger } from "tslog";
import { z } from "zod";
import { bitriseYamlSchema } from "./bitrise_config.ts";
import { circleciYamlSchema } from "./circleci_config.ts";
import { githubYamlSchema } from "./github_config.ts";
import { jenkinsYamlSchema } from "./jenkins_config.ts";

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

export function createJsonSchema(): z.core.JSONSchema.BaseSchema {
  return {
    ...z.toJSONSchema(yamlSchema),
    title: "CIAnalyzer config schema",
  };
}

export function loadConfig(
  logger: Logger<unknown>,
  configPath: string,
): YamlConfig {
  const config = yamlLoad(fs.readFileSync(configPath, "utf8"));

  if (!config || typeof config !== "object") {
    throw new Error(`Failed to load ${configPath} or config is not object`);
  }

  logger.debug("Parsed config file:");
  logger.debug(JSON.stringify(config, null, 2));

  return config as YamlConfig;
}

// Remove _errors: [] in nested properties for human readability
function formatErrorForLog(error: z.ZodError): string {
  return JSON.stringify(
    error.format(),
    (key, value) => {
      if (key === "_errors" && Array.isArray(value) && value.length === 0) {
        return undefined;
      }

      return value;
    },
    2,
  );
}

function createInvalidConfigMessage(error: z.ZodError): string {
  return `Invalid config. Formatted zod error:\n${formatErrorForLog(error)}`;
}

export function validateConfig(
  logger: Logger<unknown>,
  config: YamlConfig,
  strict = false,
): ValidatedYamlConfig {
  const parseResult = yamlSchema.safeParse(config);

  if (parseResult.success) {
    return {
      ...config,
      _configValidated: true,
    };
  }

  const message = createInvalidConfigMessage(parseResult.error);

  if (strict === true) {
    throw new Error(message);
  }

  logger.warn(message);

  return {
    ...config,
    _configValidated: true,
  };
}
