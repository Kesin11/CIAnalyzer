#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Logger } from "tslog";
import {
  ArgumentOptions,
  createHelpMessage,
  parseCliArgs,
} from "./arg_options.ts";
import { loadConfig } from "./config/config.ts";
import { CompositRunner } from "./runner/runner.ts";
import { validateConfig } from "./config/config.ts";

const baseLoggerForStyles = new Logger();

const readPackageVersion = (): string => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };

  return packageJson.version;
};

const main = async () => {
  let argv: ReturnType<typeof parseCliArgs>;
  try {
    argv = parseCliArgs();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    console.error(createHelpMessage());
    process.exitCode = 1;
    return;
  }

  if (argv.help) {
    console.log(createHelpMessage());
    return;
  }

  if (argv.version) {
    console.log(readPackageVersion());
    return;
  }

  const argOptions = new ArgumentOptions(argv);
  const logger = new Logger({
    minLevel: argOptions.logLevel,
    pretty: {
      template: "{{logLevelName}}\t[{{name}}]",
      styles: {
        ...baseLoggerForStyles.settings.pretty.styles,
        name: "whiteBright",
      },
    },
  });

  const yamlConfig = loadConfig(logger, argOptions.configPath);
  const validatedYamlConfig = validateConfig(logger, yamlConfig);
  const runner = new CompositRunner(logger, validatedYamlConfig, argOptions);
  const result = await runner.run();

  if (result.isFailure()) {
    logger.error(result.value);
    process.exitCode = 1;
  }
};
main();
