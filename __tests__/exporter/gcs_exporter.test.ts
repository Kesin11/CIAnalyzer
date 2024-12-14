import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GcsExporter } from "../../src/exporter/gcs_exporter";
import type { GcsExporterConfig } from "../../src/config/schema";
import { Logger } from "tslog";

describe("GcsExporter", () => {
  const baseConfig: GcsExporterConfig = {
    project: "project",
    bucket: "bucket",
    pathTemplate: "gs://path/{reportType}/{YYYY}/{MM}/{DD}/{hh}/{mm}/{ss}.json",
  };
  const logger = new Logger({ type: "hidden" });

  beforeEach(() => {
    // Mock the current time for `now = dayjs()`
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2023-01-01T12:34:56Z"));
  });

  afterEach(() => {
    vi.useRealTimers()
  });

  describe("new", () => {
    it("should not throw when all required params are provided", () => {
      expect(() => {
        new GcsExporter(logger, baseConfig);
      }).not.toThrow();
    });

    it("should throw when pathTemplate does not include {reportType}", () => {
      const config = { ...baseConfig, pathTemplate: "gs://path/{YYYY}/{MM}/{DD}/{hh}/{mm}/{ss}.json" };
      expect(() => {
        new GcsExporter(logger, config);
      }).toThrow();
    });
  });

  describe("createFilePath", () => {
    it("should create file path with all placeholders", () => {
      const exporter = new GcsExporter(logger, baseConfig);
      const filePath = exporter.createFilePath("workflow");
      expect(filePath).toBe("path/workflow/2023/01/01/12/34/56.json");
    });

    it("should create file path without gs:// prefix", () => {
      const config = { ...baseConfig, pathTemplate: "path/{reportType}/{YYYY}/{MM}/{DD}/{hh}/{mm}/{ss}.json" };
      const exporter = new GcsExporter(logger, config);
      const filePath = exporter.createFilePath("test");
      expect(filePath).toBe("path/test/2023/01/01/12/34/56.json");
    });

    it("should create file path with YYYY, MM, DD placeholders", () => {
      const config = { ...baseConfig, pathTemplate: "gs://path/{reportType}/{YYYY}/{MM}/{DD}.json" };
      const exporter = new GcsExporter(logger, config);
      const filePath = exporter.createFilePath("test");
      expect(filePath).toBe("path/test/2023/01/01.json");
    });
  });
});
