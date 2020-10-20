import { YamlConfig } from "../config/config";
import { GithubRunner } from "./github_runner";
import { CircleciRunner } from "./circleci_runner";
import { JenkinsRunner } from "./jenkins_runner";

export interface Runner {
  run (): Promise<void>
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

  async run () {
    await Promise.all(
      this.runners.map((runner) => runner.run())
    )
  }
}