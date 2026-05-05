import type { Runner } from "./runner.ts";
import type { ValidatedYamlConfig } from "../config/config.ts";
import type { ArgumentOptions } from "../arg_options.ts";
import type { Logger } from "tslog";
import { CircleciRunnerV2 } from "./circleci_runner_v2.ts";
import type { Result } from "../result.ts";

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
