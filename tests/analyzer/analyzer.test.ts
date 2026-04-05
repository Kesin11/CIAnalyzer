import { describe, it, expect, beforeEach } from "vitest";
import {
  convertToReportTestSuites,
  convertToTestReports,
} from "../../src/analyzer/analyzer.ts";
import type { TestSuites } from "junit2json";

describe("Analyzer", () => {
  describe("convertToReportTestSuites", () => {
    describe("Omit some properties", () => {
      let testSuites: TestSuites;

      beforeEach(() => {
        testSuites = {
          tests: 1,
          failures: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              failures: 1,
              testcase: [], // Assigning testcase at each testcase
            },
          ],
        };
      });

      it("testcase.error", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            error: [
              {
                inner: "assert xxx",
              },
            ],
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("error");
      });

      it("testcase.failure", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            failure: [
              {
                inner: "assert xxx",
              },
            ],
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("failure");
      });

      it("testcase.system-out", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            "system-out": ["stdout"],
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("system-out");
      });

      it("testcase.system-out", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            skipped: [
              {
                message: "skip reason",
              },
            ],
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("skipped");
      });

      it("testcase.system-err", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            "system-err": ["stderr"],
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("system-err");
      });

      it("testsuite.system-out", async () => {
        const testSuite = [
          {
            name: "testsuite",
            tests: 1,
            testcase: [
              {
                name: "testcase",
                classname: "test",
              },
            ],
            "system-out": ["stdout"],
          },
        ];
        testSuites.testsuite = testSuite;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0],
        ).not.toHaveProperty("system-out");
      });

      it("testsuite.system-err", async () => {
        const testSuite = [
          {
            name: "testsuite",
            tests: 1,
            testcase: [
              {
                name: "testcase",
                classname: "test",
              },
            ],
            "system-err": ["stderr"],
          },
        ];
        testSuites.testsuite = testSuite;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0],
        ).not.toHaveProperty("system-err");
      });

      it("testsuite.properties", async () => {
        const testSuite = [
          {
            name: "testsuite",
            tests: 1,
            testcase: [
              {
                name: "testcase",
                classname: "test",
              },
            ],
            properties: [
              {
                name: "property",
                value: "property value",
              },
            ],
          },
        ];
        testSuites.testsuite = testSuite;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0],
        ).not.toHaveProperty("properties");
      });

      it("testSuites has not failure", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                },
              ],
            },
          ],
        };
        const expected = JSON.parse(JSON.stringify(testSuites));
        expected.testsuite[0].testcase[0].successCount = expect.anything();
        expected.testsuite[0].testcase[0].status = expect.anything();

        expect(convertToReportTestSuites(testSuites)).toStrictEqual(expected);
      });

      it("drops unknown testcase properties such as file", async () => {
        const testCase = [
          {
            name: "testcase",
            classname: "test",
            file: "/tmp/test.ts",
          },
        ];
        testSuites.testsuite![0].testcase = testCase;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0],
        ).not.toHaveProperty("file");
      });

      it("drops unknown testsuite properties", async () => {
        const testSuite = [
          {
            name: "testsuite",
            tests: 1,
            testcase: [
              {
                name: "testcase",
                classname: "test",
              },
            ],
            mystery: "unknown field",
          },
        ];
        testSuites.testsuite = testSuite;

        expect(
          convertToReportTestSuites(testSuites).testsuite[0],
        ).not.toHaveProperty("mystery");
      });
    });

    describe("Add testcase.successCount", () => {
      it("successCount = 1 when testcase is success", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0]
            .successCount;
        expect(actual).toEqual(1);
      });

      it("successCount = 0 when testcase is failed", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          failures: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              failures: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  failure: [
                    {
                      inner: "assert xxx",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0]
            .successCount;
        expect(actual).toEqual(0);
      });

      it("successCount = 0 when testcase is error", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          failures: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              failures: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  error: [
                    {
                      inner: "some error",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0]
            .successCount;
        expect(actual).toEqual(0);
      });

      it("successCount = 0 when testcase is skipped", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          failures: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              failures: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  skipped: [
                    {
                      message: "test skip: reason xxx",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0]
            .successCount;
        expect(actual).toEqual(0);
      });
    });

    describe("Add testcase.status", () => {
      it("when testcase is success", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0].status;
        expect(actual).toEqual("SUCCESS");
      });

      it("when testcase is failure", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  failure: [
                    {
                      inner: "assert xxx",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0].status;
        expect(actual).toEqual("FAILURE");
      });

      it("when testcase is error", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  error: [
                    {
                      inner: "assert xxx",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0].status;
        expect(actual).toEqual("ERROR");
      });

      it("when testcase is skipped", async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [
            {
              name: "testsuite",
              tests: 1,
              testcase: [
                {
                  name: "testcase",
                  classname: "test",
                  skipped: [
                    {
                      message: "test skip: reason xxx",
                    },
                  ],
                },
              ],
            },
          ],
        };

        const actual =
          convertToReportTestSuites(testSuites).testsuite[0].testcase[0].status;
        expect(actual).toEqual("SKIPPED");
      });
    });
  });

  describe("convertToTestReports", () => {
    it("drops unknown JUnit testcase attributes from parsed XML", async () => {
      const workflowReport = {
        workflowId: "repo-ci",
        workflowRunId: "repo-ci-1",
        buildNumber: 1,
        workflowName: "CI",
        createdAt: new Date("2026-04-05T00:00:00.000Z"),
        branch: "master",
        service: "github",
      } as any;
      const junitArtifact = {
        path: "junit.xml",
        data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="CIAnalyzer tests" tests="1" failures="0" errors="0">
  <testsuite name="suite" tests="1" failures="0" errors="0" skipped="0" time="0.1">
    <testcase classname="test.spec.ts" name="works" file="/tmp/test.spec.ts" time="0.1" />
  </testsuite>
</testsuites>`),
      } as any;

      const reports = await convertToTestReports(workflowReport, [junitArtifact]);

      expect(reports).toHaveLength(1);
      expect(reports[0].testSuites.testsuite[0].testcase[0]).toStrictEqual({
        classname: "test.spec.ts",
        name: "works",
        time: 0.1,
        successCount: 1,
        status: "SUCCESS",
      });
    });
  });
});
