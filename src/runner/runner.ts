import { YamlConfig } from "../config/config";
import { GithubRunner } from "./github_runner";
import { CircleciRunner } from "./circleci_runner";
import { JenkinsRunner } from "./jenkins_runner";
import { failure, Result, success } from "../result";
import { BitriseRunner } from "./bitrise_runner";
import { ArgumentOptions } from "../arg_options";

export interface Runner {
  run (): Promise<Result<unknown, Error>>
}

export class CompositRunner implements Runner {
  runners: Runner[]
  constructor(public config: YamlConfig, public options: ArgumentOptions) {
    const services = options.onlyServices
      ? Object.keys(config).filter((service) => options.onlyServices?.includes(service))
      : Object.keys(config)

    this.runners = services.map((service) => {
      switch (service) {
        case 'github':
          return new GithubRunner(config, options)
        case 'circleci':
          return new CircleciRunner(config, options)
        case 'jenkins':
          return new JenkinsRunner(config, options)
        case 'bitrise':
          return new BitriseRunner(config, options)
        default:
          return undefined
      }
    }).filter((runner): runner is NonNullable<typeof runner> => runner !== undefined)
  }

  async run(): Promise<Result<unknown, Error>> {
    const results = await Promise.allSettled(
      this.runners.map((runner) => runner.run())
    )

    const errorResults = results.filter((result) => {
      return result.status === 'rejected' ||
        (result.status === 'fulfilled' && result.value.isFailure())
    })
    if (errorResults.length > 0) {
      errorResults.forEach((error) => console.error(error))
      return failure(new Error('Some runner throws error!!'))
    }

    return success('composit')
  }
}