import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { S3Exporter } from "../../src/exporter/s3_exporter.ts";
import type { S3ExporterConfig } from "../../src/config/schema.ts";
import { Logger } from "tslog";

const mockS3Client = {
  send: vi.fn().mockResolvedValue({}),
};
const logger = new Logger({ type: "hidden" });

describe("S3Exporter", () => {
  const baseConfig: S3ExporterConfig = {
    region: "us-west-2",
    bucket: "bucket",
    prefixTemplate: "ci_analyzer/{reportType}/dt={YYYY}-{MM}-{DD}/",
  };

  beforeEach(() => {
    // Mock the current time for `now = dayjs()`
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-01-01T12:34:56Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("new", () => {
    it("should not throw when all required params are provided", () => {
      expect(() => {
        new S3Exporter(logger, "github", baseConfig);
      }).not.toThrow();
    });

    it("should throw when region is not provided", () => {
      const config = {
        bucket: baseConfig.bucket,
        prefixTemplate: baseConfig.prefixTemplate,
      } as S3ExporterConfig;
      expect(() => {
        new S3Exporter(logger, "github", config);
      }).toThrow();
    });

    it("should throw when bucket is not provided", () => {
      const config = {
        region: baseConfig.region,
        prefixTemplate: baseConfig.prefixTemplate,
      } as S3ExporterConfig;
      expect(() => {
        new S3Exporter(logger, "github", config);
      }).toThrow();
    });

    it("should throw when prefixTemplate does not include {reportType}", () => {
      const config = {
        ...baseConfig,
        prefixTemplate: "ci_analyzer/dt={YYYY}-{MM}-{DD}/",
      };
      expect(() => {
        new S3Exporter(logger, "github", config);
      }).toThrow();
    });
  });

  describe("export", () => {
    let exporter: S3Exporter;

    beforeEach(() => {
      exporter = new S3Exporter(logger, "github", baseConfig);
      exporter.s3Client = mockS3Client as any;
    });

    it("exportWorkflowReports should create correct file path when all reports have the same createdAt", async () => {
      const report = [{ createdAt: "2023-01-01T12:34:56Z" }];
      await exporter.exportWorkflowReports(report as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      // Verify the PutObjectCommand parameters
      const callArg = mockS3Client.send.mock.calls[0][0];
      expect(callArg.input.Bucket).toBe("bucket");
      expect(callArg.input.Key).toBe(
        "ci_analyzer/workflow/dt=2023-01-01/20230101-123456-workflow-github.json",
      );
      expect(callArg.input.ContentType).toBe("application/json");
    });

    it("exportWorkflowReports should create correct file paths when reports have different createdAt", async () => {
      const reports = [
        { createdAt: "2023-01-01T12:34:56Z" },
        { createdAt: "2022-12-31T12:34:56Z" },
        { createdAt: "2023-01-01T12:34:56Z" },
      ];
      await exporter.exportWorkflowReports(reports as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
      // First call - 2023-01-01
      const firstCallArg = mockS3Client.send.mock.calls[0][0];
      expect(firstCallArg.input.Key).toBe(
        "ci_analyzer/workflow/dt=2023-01-01/20230101-123456-workflow-github.json",
      );
      // Second call - 2022-12-31
      const secondCallArg = mockS3Client.send.mock.calls[1][0];
      expect(secondCallArg.input.Key).toBe(
        "ci_analyzer/workflow/dt=2022-12-31/20230101-123456-workflow-github.json",
      );
    });

    it("exportTestReports should create correct file path when all reports have the same createdAt", async () => {
      const report = [{ createdAt: "2023-01-01T12:34:56Z" }];
      await exporter.exportTestReports(report as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      const callArg = mockS3Client.send.mock.calls[0][0];
      expect(callArg.input.Key).toBe(
        "ci_analyzer/test/dt=2023-01-01/20230101-123456-test-github.json",
      );
    });

    it("exportTestReports should create correct file paths when reports have different createdAt", async () => {
      const reports = [
        { createdAt: "2023-01-01T12:34:56Z" },
        { createdAt: "2022-12-31T12:34:56Z" },
        { createdAt: "2023-01-01T12:34:56Z" },
      ];
      await exporter.exportTestReports(reports as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
      // First call - 2023-01-01
      const firstCallArg = mockS3Client.send.mock.calls[0][0];
      expect(firstCallArg.input.Key).toBe(
        "ci_analyzer/test/dt=2023-01-01/20230101-123456-test-github.json",
      );
      // Second call - 2022-12-31
      const secondCallArg = mockS3Client.send.mock.calls[1][0];
      expect(secondCallArg.input.Key).toBe(
        "ci_analyzer/test/dt=2022-12-31/20230101-123456-test-github.json",
      );
    });

    it("exportCustomReports should create correct file path when all reports have the same createdAt", async () => {
      const report = [{ createdAt: "2023-01-01T12:34:56Z" }];
      const customReportCollection = {
        customReports: new Map([["custom", report]]),
      };
      await exporter.exportCustomReports(customReportCollection as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      const callArg = mockS3Client.send.mock.calls[0][0];
      expect(callArg.input.Key).toBe(
        "ci_analyzer/custom/dt=2023-01-01/20230101-123456-custom-github.json",
      );
    });

    it("exportCustomReports should create correct file paths when reports have different createdAt", async () => {
      const reports = [
        { createdAt: "2023-01-01T12:34:56Z" },
        { createdAt: "2022-12-31T12:34:56Z" },
        { createdAt: "2023-01-01T12:34:56Z" },
      ];
      const customReportCollection = {
        customReports: new Map([["custom", reports]]),
      };
      await exporter.exportCustomReports(customReportCollection as any);

      expect(mockS3Client.send).toHaveBeenCalledTimes(2);
      // First call - 2023-01-01
      const firstCallArg = mockS3Client.send.mock.calls[0][0];
      expect(firstCallArg.input.Key).toBe(
        "ci_analyzer/custom/dt=2023-01-01/20230101-123456-custom-github.json",
      );
      // Second call - 2022-12-31
      const secondCallArg = mockS3Client.send.mock.calls[1][0];
      expect(secondCallArg.input.Key).toBe(
        "ci_analyzer/custom/dt=2022-12-31/20230101-123456-custom-github.json",
      );
    });
  });
});
