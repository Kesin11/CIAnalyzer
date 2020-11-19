import { YamlConfig } from "../config/config";
import { GithubRunner } from "./github_runner";
import { CircleciRunner } from "./circleci_runner";
import { JenkinsRunner } from "./jenkins_runner";
import { failure, Result, success } from "../result";

export interface Runner {
  run (): Promise<Result<void, Error>>
}

export class CompositRunner implements Runner {
  runners: Runner[]
  constructor(public config: YamlConfig) {
    this.runners = Object.keys(config).map((service) => {
      switch (service) {
        case 'github':
          return new GithubRunner(config)
        case 'circleci':
          return new CircleciRunner(config)
        case 'jenkins':
          return new JenkinsRunner(config)
        default:
          return undefined
      }
    }).filter((runner): runner is NonNullable<typeof runner> => runner !== undefined)
  }

  async run(): Promise<Result<void, Error>> {
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

    return success()
  }
}