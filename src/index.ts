#!/usr/bin/env node
import { Logger } from 'tslog'
import yargs from 'yargs'
import { ArgumentOptions } from './arg_options'
import { loadConfig } from './config/config'
import { CompositRunner } from './runner/runner'

const defaultConfigPath = './ci_analyzer.yaml'

const main = async () => {
  const argv = await yargs
    .command(['$0', 'workflow'], 'Collect workflow data from CI services', (yargs) => {}, () => {})
    .options({
      c: { type: 'string', alias: 'config', default: defaultConfigPath, describe: 'Path to config yaml' },
      v: { type: 'count', alias: 'verbose' },
      'debug': { type: 'boolean', default: false, describe: 'Enable debug mode' },
      'only-services': { type: 'string', array: true, describe: 'Exec only selected services. ex: --only-services circleci github' },
      'only-exporters': { type: 'string', array: true, describe: 'Export data using only selected exporters. ex: --only-exporters local' },
    })
    .strict()
    .argv
  const argOptions = new ArgumentOptions(argv)
  const logger = new Logger({
    overwriteConsole: true,
    minLevel: argOptions.logLevel,
    displayInstanceName: true,
    displayDateTime: false,
    displayFunctionName: false,
    displayFilePath: "hidden",
  })

  const yamlConfig = loadConfig(logger, argOptions.configPath)
  const runner = new CompositRunner(logger, yamlConfig, argOptions)
  const result = await runner.run()

  if (result.isFailure()) {
    console.error(result.value)
    process.exitCode = 1
  }
}
main()