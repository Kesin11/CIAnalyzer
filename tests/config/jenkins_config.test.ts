import { describe, it, expect, beforeEach } from "vitest";
import { Logger } from "tslog";
import { parseConfig } from "../../src/config/jenkins_config.ts";

const logger = new Logger({ type: "hidden" });

describe("parseConfig", () => {
  it("when repos are string", () => {
    const config = {
      jenkins: {
        baseUrl: "http://localhost:8080",
        jobs: ["sample-job"],
      },
    };

    const actual = parseConfig(config, logger);
    expect(actual).toEqual({
      baseUrl: "http://localhost:8080",
      jobs: [
        {
          name: "sample-job",
          testGlob: [],
          customReports: [],
        },
      ],
    });
  });

  describe("when repos are object", () => {
    it("that has only name", () => {
      const config = {
        jenkins: {
          baseUrl: "http://localhost:8080",
          jobs: [
            {
              name: "sample-job",
            },
          ],
        },
      };

      const actual = parseConfig(config, logger);
      expect(actual).toEqual({
        baseUrl: "http://localhost:8080",
        jobs: [
          {
            name: "sample-job",
            testGlob: [],
            customReports: [],
          },
        ],
      });
    });

    it("that has tests", () => {
      const config = {
        jenkins: {
          baseUrl: "http://localhost:8080",
          jobs: [
            {
              name: "sample-job",
              tests: ["**/*.xml"],
            },
          ],
        },
      };

      const actual = parseConfig(config, logger);
      expect(actual).toEqual({
        baseUrl: "http://localhost:8080",
        jobs: [
          {
            name: "sample-job",
            testGlob: ["**/*.xml"],
            customReports: [],
          },
        ],
      });
    });

    it("that has customReports", () => {
      const config = {
        jenkins: {
          baseUrl: "http://localhost:8080",
          jobs: [
            {
              name: "sample-job",
              customReports: [{ name: "custom", paths: ["**/custom.xml"] }],
            },
          ],
        },
      };

      const actual = parseConfig(config, logger);
      expect(actual).toEqual({
        baseUrl: "http://localhost:8080",
        jobs: [
          {
            name: "sample-job",
            testGlob: [],
            customReports: [{ name: "custom", paths: ["**/custom.xml"] }],
          },
        ],
      });
    });
  });

  describe("with deprecated keys that need to migrate", () => {
    const commonConfig = {
      baseUrl: "http://localhost:8080",
      jobs: [
        {
          name: "sample-job",
        },
      ],
    };
    const commonActual = {
      baseUrl: "http://localhost:8080",
      jobs: [
        {
          name: "sample-job",
          testGlob: [],
          customReports: [],
        },
      ],
    };

    it("correctAllJobs", () => {
      const config = {
        jenkins: {
          ...commonConfig,
          correctAllJobs: {
            filterLastBuildDay: 1,
            isRecursively: true,
          },
        },
      };

      const actual = parseConfig(config, logger);
      expect(actual).toEqual({
        ...commonActual,
        collectAllJobs: {
          filterLastBuildDay: 1,
          isRecursively: true,
        },
      });
    });
  });
});
