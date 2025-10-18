#!/usr/bin/env node
import { Logger } from "tslog";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ArgumentOptions } from "./arg_options.js";
import { loadConfig } from "./config/config.js";
import { CompositRunner } from "./runner/runner.js";
import { validateConfig } from "./config/config.js";

const defaultConfigPath = "./ci_analyzer.yaml";
const baseLoggerForStyles = new Logger();

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .command(
      ["$0", "workflow"],
      "Collect workflow data from CI services",
      (_yargs) => {},
      () => {},
    )
    .options({
      c: {
        type: "string",
        alias: "config",
        default: defaultConfigPath,
        describe: "Path to config yaml",
      },
      v: { type: "count", alias: "verbose" },
      debug: { type: "boolean", default: false, describe: "Enable debug mode" },
      "only-services": {
        type: "string",
        array: true,
        describe:
          "Exec only selected services. ex: --only-services circleci github",
      },
      "only-exporters": {
        type: "string",
        array: true,
        describe:
          "Export data using only selected exporters. ex: --only-exporters local",
      },
      keepalive: {
        type: "boolean",
        default: true,
        describe: "Enable http/https keepalive",
      },
      "max-concurrent-requests": {
        type: "number",
        default: 10,
        describe:
          "Limit http request concurrency per service. When set 0, disable concurrency limit",
      },
      "force-save-last-run": {
        type: "boolean",
        default: false,
        describe:
          "Save last run state even when errors occur during data collection",
      },
    })
    .strict()
    .parseSync();
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
