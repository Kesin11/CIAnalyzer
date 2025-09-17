import { describe, it, expect, beforeEach } from "vitest";
import {
  CircleciRunnerV2,
  type CircleciV2LastRunMetadata,
} from "../../src/runner/circleci_runner_v2.ts";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { LastRunStore } from "../../src/last_run_store.ts";
import { NullStore } from "../../src/store/null_store.ts";
import { validateConfig } from "../../src/config/config.ts";

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
    version: 2 as const,
  },
};

describe("migrateLastRun", () => {
  let runner: CircleciRunnerV2;
  beforeEach(async () => {
    runner = new CircleciRunnerV2(
      logger,
      validateConfig(logger, config),
      argOptions,
    );
    const nullStore = new NullStore(logger);
    runner.store = new LastRunStore<CircleciV2LastRunMetadata>(nullStore);
  });

  it("new repo", async () => {
    runner.migrateLastRun(repo);

    expect(runner.store!.lastRun[repo]).toEqual({
      lastRun: 0,
      updatedAt: expect.anything(),
      meta: {
        version: 2,
      },
    });
  });

  it("undefined metadata to version:2", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: undefined,
    };
    runner.migrateLastRun(repo);

    expect(runner.store!.lastRun[repo]).toEqual({
      lastRun: 0,
      updatedAt: expect.anything(),
      meta: {
        version: 2,
      },
    });
  });

  it("version:1 to version:2", async () => {
    runner.store!.lastRun[repo] = {
      lastRun: 1,
      updatedAt: new Date(),
      meta: {
        version: 1,
      },
    };
    runner.migrateLastRun(repo);

    expect(runner.store!.getMeta(repo)).toEqual({ version: 2 });
  });

  it("version:2 to version:2", async () => {
    const lastRun = 1;
    runner.store!.lastRun[repo] = {
      lastRun,
      updatedAt: new Date(),
      meta: {
        version: 2,
      },
    };
    runner.migrateLastRun(repo);

    expect(runner.store!.lastRun[repo]).toEqual({
      lastRun,
      updatedAt: expect.anything(),
      meta: {
        version: 2,
      },
    });
  });

  it("version:>2 to version:2", async () => {
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
