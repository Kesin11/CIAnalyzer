import { Runner } from "./runner"
import { YamlConfig } from "../config/config"
import { ArgumentOptions } from "../arg_options"
import { Logger } from "tslog"
import { CircleciRunnerV1 } from "./circleci_runner_v1"
import { CircleciRunnerV2 } from "./circleci_runner_v2"
import { parseConfig } from "../config/circleci_config"
import { Result } from "../result"

export class CircleciRunner implements Runner {
  config: YamlConfig
  logger: Logger
  options: ArgumentOptions
  constructor(logger: Logger, yamlConfig: YamlConfig, options: ArgumentOptions) {
    this.logger = logger
    this.config = yamlConfig
    this.options = options
  }

  async run (): Promise<Result<unknown, Error>> {
    let runner: CircleciRunnerV1 | CircleciRunnerV2
    const config = parseConfig(this.config)
    switch (config?.version) {
      case "2":
        runner = new CircleciRunnerV2(this.logger, this.config, this.options)
        break;
      default:
        runner = new CircleciRunnerV1(this.logger, this.config, this.options)
        break;
    }

    const hostAvailableResult = await runner.isHostAvailableVersion()
    if (hostAvailableResult.isFailure()) return hostAvailableResult

    return await runner.run()
  }
}
