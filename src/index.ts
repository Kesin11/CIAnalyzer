import { loadConfig } from './config/config'
import { CompositRunner } from './runner/runner'

const main = async () => {
  const yamlConfig = loadConfig()

  const runner = new CompositRunner(yamlConfig)
  await runner.run()
}
main()