import type { ValidatedYamlConfig } from "../config/config.js";
import { GithubRunner } from "./github_runner.js";
import { CircleciRunner } from "./circleci_runner.js";
import { JenkinsRunner } from "./jenkins_runner.js";
import { Failure, failure, type Result, success } from "../result.js";
import { BitriseRunner } from "./bitrise_runner.js";
import type { ArgumentOptions } from "../arg_options.js";
import type { Logger } from "tslog";
import { ApiError } from "@google-cloud/common";
import axios from "axios";
import { summarizeAxiosError } from "../error.js";

export interface Runner {
  run(): Promise<Result<unknown, Error>>;
}

export class CompositRunner implements Runner {
  runners: Runner[];
  #logger: Logger<unknown>;
  constructor(
    logger: Logger<unknown>,
    public config: ValidatedYamlConfig,
    public options: ArgumentOptions,
  ) {
    this.#logger = logger;
    const services = options.onlyServices
      ? Object.keys(config).filter((service) =>
          options.onlyServices?.includes(service),
        )
      : Object.keys(config);

    this.runners = services
      .map((service) => {
        switch (service) {
          case "github":
            return new GithubRunner(logger, config, options);
          case "circleci":
            return new CircleciRunner(logger, config, options);
          case "jenkins":
            return new JenkinsRunner(logger, config, options);
          case "bitrise":
            return new BitriseRunner(logger, config, options);
          default:
            return undefined;
        }
      })
      .filter((runner) => runner !== undefined);
  }

  async run(): Promise<Result<unknown, Error>> {
    const results = await Promise.allSettled(
      this.runners.map((runner) => runner.run()),
    );

    const errors = results
      .filter((result) => {
        return (
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value.isFailure())
        );
      })
      .map((result) => {
        if (result.status === "rejected") return result.reason;
        return result.value;
      }) as unknown[];
    if (errors.length > 0) {
      errors.forEach((error) => this.handlingError(error));
      return failure(new Error("Some runner throws error!!"));
    }

    return success("composit");
  }

  handlingError(error: unknown) {
    if (axios.isAxiosError(error)) {
      this.#logger.error("Catch HTTP fetch error.");
      this.#logger.error(summarizeAxiosError(error));
    } else if (error instanceof ApiError) {
      this.#logger.error(
        "Catch GCloud Error. Please check 'gcloud' auth status or your permission.",
      );
      this.#logger.error(`${error.response?.body}`);
      this.#logger.error(error.stack);
    } else if (error instanceof Error) {
      this.#logger.error(error);
      if (error.cause) this.handlingError(error.cause);
    } else if (error instanceof Failure) {
      this.handlingError(error.value);
    } else {
      this.#logger.error(error);
    }
  }
}
