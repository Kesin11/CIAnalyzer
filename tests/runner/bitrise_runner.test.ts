import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { validateConfig } from "../../src/config/config.ts";
import { CompositExporter } from "../../src/exporter/exporter.ts";
import { LastRunStore } from "../../src/last_run_store.ts";
import {
  BITRISE_DEPRECATION_WARNING,
  BitriseRunner,
} from "../../src/runner/bitrise_runner.ts";
import { NullStore } from "../../src/store/null_store.ts";

const logger = new Logger({ type: "hidden" });
const argOptions = new ArgumentOptions({
  c: "ci_analyzer.yaml",
  v: 0,
  debug: true,
});
const config = {
  bitrise: {
    apps: ["owner/app"],
  },
};

describe("BitriseRunner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns that Bitrise support is deprecated when run", async () => {
    vi.spyOn(LastRunStore, "init").mockResolvedValue(
      new LastRunStore(new NullStore(logger)),
    );
    vi.spyOn(
      CompositExporter.prototype,
      "exportWorkflowReports",
    ).mockResolvedValue();
    vi.spyOn(
      CompositExporter.prototype,
      "exportTestReports",
    ).mockResolvedValue();
    vi.spyOn(
      CompositExporter.prototype,
      "exportCustomReports",
    ).mockResolvedValue();

    const runner = new BitriseRunner(
      logger,
      validateConfig(logger, config),
      argOptions,
    );
    vi.spyOn(runner.client, "fetchApps").mockResolvedValue([]);
    const warnSpy = vi.spyOn(runner.logger, "warn");

    const result = await runner.run();

    expect(result.isSuccess()).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(BITRISE_DEPRECATION_WARNING);
  });
});
