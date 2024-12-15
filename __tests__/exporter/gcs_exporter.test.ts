import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GcsExporter } from "../../src/exporter/gcs_exporter";
import type { GcsExporterConfig } from "../../src/config/schema";
import { Logger } from "tslog";

const mockStorage = {
  bucket: vi.fn().mockReturnThis(),
  file: vi.fn().mockReturnThis(),
  save: vi.fn(),
};
const logger = new Logger({ type: "hidden" });

describe("GcsExporter", () => {
  const baseConfig: GcsExporterConfig = {
    project: "project",
    bucket: "bucket",
    prefixTemplate: "ci_analyzer/{reportType}/dt={YYYY}-{MM}-{DD}/",
  };

  beforeEach(() => {
    // Mock the current time for `now = dayjs()`
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-01-01T12:34:56Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("new", () => {
    it("should not throw when all required params are provided", () => {
      expect(() => {
        new GcsExporter(logger, "github", baseConfig);
      }).not.toThrow();
    });

    it("should throw when prefixTemplate does not include {reportType}", () => {
      const config = {
        ...baseConfig,
        prefixTemplate: "ci_analyzer/dt={YYYY}-{MM}-{DD}/",
      };
      expect(() => {
        new GcsExporter(logger, "github", config);
      }).toThrow();
    });
  });

  describe("createFilePath", () => {
    it("should create file path with all placeholders", () => {
      const config = {
        ...baseConfig,
        prefixTemplate:
          "ci_analyzer/{reportType}/dt={YYYY}-{MM}-{DD}/{hh}_{mm}_{ss}/",
      };
      const exporter = new GcsExporter(logger, "github", config);
      const filePath = exporter.createFilePath("workflow");
      expect(filePath).toBe(
        "ci_analyzer/workflow/dt=2023-01-01/12_34_56/20230101-123456-workflow-github.json",
      );
    });
  });

  describe("export", () => {
    const report = [{}];
    let exporter: GcsExporter;

    beforeEach(() => {
      exporter = new GcsExporter(logger, "github", baseConfig);
      exporter.storage = mockStorage as any;
    });

    it("exportWorkflowReports should create correct file path", async () => {
      await exporter.exportWorkflowReports(report as any);

      expect(mockStorage.file).toHaveBeenCalledWith(
        "ci_analyzer/workflow/dt=2023-01-01/20230101-123456-workflow-github.json",
      );
    });

    it("exportTestReports should create correct file path", async () => {
      await exporter.exportTestReports(report as any);

      expect(mockStorage.file).toHaveBeenCalledWith(
        "ci_analyzer/test/dt=2023-01-01/20230101-123456-test-github.json",
      );
    });

    it("exportCustomReports should create correct file path", async () => {
      const customReportCollection = {
        customReports: new Map([["custom", report]]),
      };
      await exporter.exportCustomReports(customReportCollection as any);

      expect(mockStorage.file).toHaveBeenCalledWith(
        "ci_analyzer/custom/dt=2023-01-01/20230101-123456-custom-github.json",
      );
    });
  });
});
