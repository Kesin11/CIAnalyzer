import path from "node:path";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { BigqueryExporter } from "../../src/exporter/bigquery_exporter";
import type { BigqueryExporterConfig } from "../../src/config/config";
import { CustomReportCollection } from "../../src/custom_report_collection";
import { Logger } from "tslog";

const bigqueryMock = {
  dataset: vi.fn().mockReturnThis(),
  table: vi.fn().mockReturnThis(),
  load: vi.fn(async () => [{}]), // return success 'results' stub
};
const configDir = path.join(__dirname, "..", "..");
const fixtureSchemaPath = {
  custom: "./__tests__/fixture/custom_table.json",
};
const logger = new Logger({ type: "hidden" });

describe("BigqueryExporter", () => {
  const workflowTable = "workflow";
  const testReportTable = "test_report";
  const baseConfig: BigqueryExporterConfig = {
    project: "project",
    dataset: "dataset",
    reports: [
      { name: "workflow", table: workflowTable },
      { name: "test_report", table: testReportTable },
    ],
  };
  describe("new", () => {
    it("should not throw when any params are not undefined", async () => {
      expect(() => {
        new BigqueryExporter(logger, baseConfig, configDir);
      });
    });

    it("should throw when project is undefined", async () => {
      const config = { ...baseConfig, project: undefined };
      expect(() => {
        new BigqueryExporter(logger, config, configDir);
      }).toThrow();
    });

    it("should throw when dataset is undefined", async () => {
      const config = { ...baseConfig, dataset: undefined };
      expect(() => {
        new BigqueryExporter(logger, config, configDir);
      }).toThrow();
    });

    it("should throw when workflow table is undefined", async () => {
      const config = {
        ...baseConfig,
        reports: [{ name: "workflow", table: "workflow" }],
      };
      expect(() => {
        new BigqueryExporter(logger, config as any, configDir);
      }).toThrow();
    });

    it("should throw when test_report table is undefined", async () => {
      const config = {
        ...baseConfig,
        reports: [{ name: "test_report", table: "test_report" }],
      };
      expect(() => {
        new BigqueryExporter(logger, config as any, configDir);
      }).toThrow();
    });
  });

  describe("export", () => {
    const report = [{}];
    let exporter: BigqueryExporter;
    beforeEach(() => {
      exporter = new BigqueryExporter(logger, baseConfig, configDir);
      exporter.bigquery = bigqueryMock as any;
    });

    it("exportWorkflowReports load to `workflow` table", async () => {
      await exporter.exportWorkflowReports(report as any);

      expect(bigqueryMock.load.mock.calls.length).toBe(1);
      expect(bigqueryMock.table.mock.calls[0][0]).toBe(workflowTable);
    });

    it("exportTestReports load to `test_report` table", async () => {
      await exporter.exportTestReports(report as any);

      expect(bigqueryMock.load.mock.calls.length).toBe(1);
      expect(bigqueryMock.table.mock.calls[0][0]).toBe(testReportTable);
    });
  });

  describe("exportCustomReports", () => {
    const config = {
      ...baseConfig,
      customReports: [
        {
          name: "custom",
          table: "custom_table",
          schema: fixtureSchemaPath.custom,
        },
      ],
    };
    let exporter: BigqueryExporter;
    let reportCollection: CustomReportCollection;
    beforeEach(() => {
      exporter = new BigqueryExporter(logger, config, configDir);
      exporter.bigquery = bigqueryMock as any;
      reportCollection = new CustomReportCollection();
      reportCollection.set("custom", []);
    });

    it("load to `customReports[].table` table", async () => {
      await exporter.exportCustomReports(reportCollection);

      expect(bigqueryMock.load.mock.calls.length).toBe(1);
      expect(bigqueryMock.table.mock.calls[0][0]).toBe("custom_table");
    });

    it("should error when define repo.customReports but does not exists correspond config in `bigquery.customReports`", async () => {
      reportCollection.set("custom2", []);

      await expect(
        exporter.exportCustomReports(reportCollection),
      ).rejects.toThrow();
    });

    it("load multi report to `customReports[].table` table", async () => {
      const config = {
        ...baseConfig,
        customReports: [
          {
            name: "custom",
            table: "custom_table",
            schema: fixtureSchemaPath.custom,
          },
          {
            name: "custom2",
            table: "custom_table2",
            schema: fixtureSchemaPath.custom,
          },
        ],
      };
      const exporter = new BigqueryExporter(logger, config, configDir);
      exporter.bigquery = bigqueryMock as any;
      reportCollection.set("custom2", []);

      await exporter.exportCustomReports(reportCollection);

      expect(bigqueryMock.load.mock.calls.length).toBe(2);
      expect(bigqueryMock.table.mock.calls[0][0]).toBe("custom_table");
      expect(bigqueryMock.table.mock.calls[1][0]).toBe("custom_table2");
    });

    it("should error when customReports table schema json is not found", async () => {
      const config = {
        ...baseConfig,
        customReports: [
          { name: "custom", table: "custom_table", schema: "./imaginary.json" },
        ],
      };
      const exporter = new BigqueryExporter(logger, config, configDir);
      exporter.bigquery = bigqueryMock as any;

      await expect(
        exporter.exportCustomReports(reportCollection),
      ).rejects.toThrow();
    });
  });
});
