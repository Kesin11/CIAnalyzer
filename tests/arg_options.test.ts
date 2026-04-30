import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ArgumentOptions,
  createHelpMessage,
  parseCliArgs,
} from "../src/arg_options.ts";

describe("parseCliArgs", () => {
  it("uses yargs-compatible defaults", () => {
    const argv = parseCliArgs([]);
    const options = new ArgumentOptions(argv);

    expect(options.configPath).toBe(path.resolve("./ci_analyzer.yaml"));
    expect(options.debug).toBe(false);
    expect(options.logLevel).toBe(3);
    expect(options.onlyServices).toBeUndefined();
    expect(options.onlyExporters).toBeUndefined();
    expect(options.keepAlive).toBe(true);
    expect(options.maxConcurrentRequests).toBe(10);
    expect(options.forceSaveLastRun).toBe(false);
  });

  it("parses aliases, booleans, numeric options, and repeated verbose flags", () => {
    const argv = parseCliArgs([
      "-c",
      "config.yaml",
      "-vv",
      "--debug",
      "--no-keepalive",
      "--max-concurrent-requests",
      "3",
      "--force-save-last-run",
    ]);
    const options = new ArgumentOptions(argv);

    expect(options.configPath).toBe(path.resolve("config.yaml"));
    expect(options.debug).toBe(true);
    expect(options.logLevel).toBe(2);
    expect(options.keepAlive).toBe(false);
    expect(options.maxConcurrentRequests).toBe(3);
    expect(options.forceSaveLastRun).toBe(true);
  });

  it("parses yargs-style array options with space-separated values", () => {
    const argv = parseCliArgs([
      "workflow",
      "--only-services",
      "circleci",
      "github",
      "--only-services=jenkins",
      "--only-exporters",
      "local",
      "bigquery",
    ]);
    const options = new ArgumentOptions(argv);

    expect(options.onlyServices).toEqual(["circleci", "github", "jenkins"]);
    expect(options.onlyExporters).toEqual(["local", "bigquery"]);
  });

  it("disables the concurrency limit when max-concurrent-requests is 0", () => {
    const argv = parseCliArgs(["--max-concurrent-requests", "0"]);
    const options = new ArgumentOptions(argv);

    expect(options.maxConcurrentRequests).toBeUndefined();
  });

  it("throws for unknown positional arguments", () => {
    expect(() => parseCliArgs(["unknown"])).toThrow("Unknown argument");
  });
});

describe("createHelpMessage", () => {
  it("includes command description and all public options", () => {
    const help = createHelpMessage();

    expect(help).toContain("ci_analyzer [workflow]");
    expect(help).toContain("Collect workflow data from CI services");
    expect(help).toContain("-c, --config <path>");
    expect(help).toContain("-v, --verbose");
    expect(help).toContain("--only-services <services...>");
    expect(help).toContain("--only-exporters <exporters...>");
    expect(help).toContain("--force-save-last-run");
    expect(help).toContain("--help");
  });
});
