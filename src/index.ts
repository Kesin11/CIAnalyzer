#!/usr/bin/env node
import yargs from 'yargs'
import { loadConfig } from './config/config'
import { CompositRunner } from './runner/runner'


const main = async () => {
  const argv = await yargs
    .command(['$0', 'workflow'], 'Collect workflow data from CI services', (yargs) => {}, () => {})
    .options({
      c: { type: 'string', alias: 'config', describe: 'Path to config yaml' },
      v: { type: 'count', alias: 'verbose' },
    })
    .strict()
    .argv
  const yamlConfig = loadConfig(argv.c)

  const runner = new CompositRunner(yamlConfig)
  const result = await runner.run()

  if (result.isFailure()) {
    console.error(result.value)
    process.exitCode = 1
  }
}
main()