import type { Runner } from "./runner.js";
import type { ValidatedYamlConfig } from "../config/config.js";
import type { ArgumentOptions } from "../arg_options.js";
import type { Logger } from "tslog";
import { CircleciRunnerV2 } from "./circleci_runner_v2.js";
import type { Result } from "../result.js";

export class CircleciRunner implements Runner {
  config: ValidatedYamlConfig;
  logger: Logger<unknown>;
  options: ArgumentOptions;
  constructor(
    logger: Logger<unknown>,
    yamlConfig: ValidatedYamlConfig,
    options: ArgumentOptions,
  ) {
    this.logger = logger;
    this.config = yamlConfig;
    this.options = options;
  }

  async run(): Promise<Result<unknown, Error>> {
    const runner = new CircleciRunnerV2(this.logger, this.config, this.options);

    const hostAvailableResult = await runner.isHostAvailableVersion();
    if (hostAvailableResult.isFailure()) return hostAvailableResult;

    return await runner.run();
  }
}
