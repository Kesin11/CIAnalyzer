import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  CircleciRunnerV1,
  type CircleciV1LastRunMetadata,
} from "../../src/runner/circleci_runner_v1";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options";
import { LastRunStore } from "../../src/last_run_store";
import { NullStore } from "../../src/store/null_store";

const logger = new Logger({ type: "hidden" });
const argOptions = new ArgumentOptions({
  c: "cianalyzer.yml",
  v: 0,
  debug: true,
});
const repo = "owner/repo";
const config = {
  circleci: {
    repos: [repo],
    version: 1,
  },
};

describe("migrateLastRun", () => {
  let runner: CircleciRunnerV1;
  beforeEach(async () => {
    runner = new CircleciRunnerV1(logger, config, argOptions);
    const nullStore = new NullStore(logger);
    runner.store = new LastRunStore<CircleciV1LastRunMetadata>(nullStore);
  });

  it("new repo", async () => {
    runner.migrateLastRun(repo);

    expect(runner.store!.lastRun[repo]).toEqual({
      updatedAt: expect.anything(),
      meta: {
        version: 1,
      },
    });
  });

  it("undefined metadata to version:1", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: undefined,
    };
    runner.migrateLastRun(repo);

    expect(runner.store!.lastRun[repo]).toEqual({
      lastRun: 1,
      updatedAt: expect.anything(),
      meta: {
        version: 1,
      },
    });
  });

  it("version:1 to version:1", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: {
        version: 1,
      },
    };
    runner.migrateLastRun(repo);

    expect(runner.store!.getMeta(repo)).toEqual({ version: 1 });
  });

  it("version:2 to version:1", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: {
        version: 2,
      },
    };
    expect(() => {
      runner.migrateLastRun(repo);
    }).toThrow();
  });

  it("version:>2 to version:1", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: {
        version: 3,
      },
    };
    expect(() => {
      runner.migrateLastRun(repo);
    }).toThrow();
  });
});
