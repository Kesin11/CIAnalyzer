#!/usr/bin/env node
import { Logger } from "tslog";
import {
  ArgumentOptions,
  createHelpMessage,
  parseCliArgs,
} from "./arg_options.js";
import { loadConfig } from "./config/config.js";
import { CompositRunner } from "./runner/runner.js";
import { validateConfig } from "./config/config.js";

const baseLoggerForStyles = new Logger();

const main = async () => {
  const argv = parseCliArgs();
  if (argv.help) {
    console.log(createHelpMessage());
    return;
  }

  const argOptions = new ArgumentOptions(argv);
  const logger = new Logger({
    minLevel: argOptions.logLevel,
    prettyLogTemplate: "{{logLevelName}}\t[{{name}}]",
    prettyLogStyles: {
      ...baseLoggerForStyles.settings.prettyLogStyles,
      name: "whiteBright",
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
