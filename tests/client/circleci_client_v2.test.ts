import { afterEach, describe, it, expect, vi } from "vitest";
import { Logger } from "tslog";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { CircleciClientV2 } from "../../src/client/circleci_client_v2.ts";

const logger = new Logger({ type: "hidden" });
const options = new ArgumentOptions({
  c: "./dummy.yaml",
});

describe("CircleciClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("new() with baseUrl", () => {
    it("should OK when undefined", async () => {
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options);
      }).toBeTruthy();
    });

    it("should OK when /api", async () => {
      const baseUrl = "https://circleci.com/api";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toBeTruthy();
    });

    it("should OK when /api/", async () => {
      const baseUrl = "https://circleci.com/api/";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toBeTruthy();
    });

    it("should throw when /api/v1.1", async () => {
      const baseUrl = "https://circleci.com/api/v1.1";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toThrow();
    });

    it("should throw when /api/v2", async () => {
      const baseUrl = "https://circleci.com/api/v2";
      expect(() => {
        new CircleciClientV2("DUMMY_TOKEN", logger, options, baseUrl);
      }).toThrow();
    });
  });

  describe("fetchPipelineWorkflows", () => {
    it("skips jobs when CircleCI job details return 404", async () => {
      const fetch = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("/v2/workflow/workflow-id/job")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  dependencies: [],
                  id: "job-id",
                  job_number: 123,
                  name: "test",
                  project_slug: "gh/owner/repo",
                  status: "success",
                  type: "build",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/job/123")) {
          return new Response(JSON.stringify({ message: "Not Found" }), {
            status: 404,
            statusText: "Not Found",
          });
        }

        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetch);

      const client = new CircleciClientV2("DUMMY_TOKEN", logger, options);
      const workflows = await client.fetchPipelineWorkflows({
        id: "pipeline-id",
        number: 1,
        workflows: [
          {
            id: "workflow-id",
            name: "ci",
            project_slug: "gh/owner/repo",
            status: "success",
            pipeline_id: "pipeline-id",
            pipeline_number: 1,
            created_at: "2026-01-01T00:00:00Z",
            stopped_at: "2026-01-01T00:01:00Z",
          },
        ],
      } as never);

      expect(workflows[0].jobs).toEqual([]);
    });

    it("keeps exporting tests and custom reports for jobs whose details are missing", async () => {
      const fetch = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);

        if (url.includes("/v2/workflow/workflow-id/job")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  dependencies: [],
                  id: "job-id-1",
                  job_number: 123,
                  name: "test-missing-detail",
                  project_slug: "gh/owner/repo",
                  started_at: "2026-01-01T00:00:10Z",
                  status: "success",
                  stopped_at: "2026-01-01T00:00:20Z",
                  type: "build",
                },
                {
                  dependencies: [],
                  id: "job-id-2",
                  job_number: 124,
                  name: "test-with-detail",
                  project_slug: "gh/owner/repo",
                  started_at: "2026-01-01T00:00:30Z",
                  status: "success",
                  stopped_at: "2026-01-01T00:00:40Z",
                  type: "build",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/job/123")) {
          return new Response(JSON.stringify({ message: "Not Found" }), {
            status: 404,
            statusText: "Not Found",
          });
        }

        if (url.includes("/v2/project/gh/owner/repo/job/124")) {
          return new Response(
            JSON.stringify({
              contexts: [],
              created_at: "2026-01-01T00:00:00Z",
              duration: 1000,
              executor: {
                resource_class: "medium",
                type: "docker",
              },
              latest_workflow: {
                id: "workflow-id",
                name: "ci",
              },
              messages: [],
              name: "test-with-detail",
              number: 124,
              organization: {
                name: "owner",
              },
              parallel_runs: [],
              parallelism: 1,
              pipeline: {
                id: "pipeline-id",
              },
              project: {
                external_url: "https://github.com/owner/repo",
                name: "repo",
                slug: "gh/owner/repo",
              },
              queued_at: "2026-01-01T00:00:00Z",
              started_at: "2026-01-01T00:00:30Z",
              status: "success",
              stopped_at: "2026-01-01T00:00:40Z",
              web_url: "https://circleci.com/gh/owner/repo/124",
            }),
          );
        }

        if (url.includes("/v1.1/project/gh/owner/repo/124")) {
          return new Response(
            JSON.stringify({
              build_num: 124,
              steps: [],
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/123/tests")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  classname: "MissingDetailTest",
                  file: "missing.test.ts",
                  message: null,
                  name: "still exported",
                  result: "success",
                  run_time: 1,
                  source: "unknown",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/124/tests")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  classname: "DetailedTest",
                  file: "detailed.test.ts",
                  message: null,
                  name: "also exported",
                  result: "success",
                  run_time: 1,
                  source: "unknown",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/123/artifacts")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  path: "reports/job-123.json",
                  url: "https://example.com/job-123.json",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url.includes("/v2/project/gh/owner/repo/124/artifacts")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  path: "reports/job-124.json",
                  url: "https://example.com/job-124.json",
                },
              ],
              next_page_token: null,
            }),
          );
        }

        if (url === "https://example.com/job-123.json") {
          return new Response(JSON.stringify({ job: 123 }));
        }

        if (url === "https://example.com/job-124.json") {
          return new Response(JSON.stringify({ job: 124 }));
        }

        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal("fetch", fetch);

      const client = new CircleciClientV2("DUMMY_TOKEN", logger, options);
      const workflows = await client.fetchPipelineWorkflows({
        id: "pipeline-id",
        number: 1,
        workflows: [
          {
            id: "workflow-id",
            name: "ci",
            project_slug: "gh/owner/repo",
            status: "success",
            pipeline_id: "pipeline-id",
            pipeline_number: 1,
            created_at: "2026-01-01T00:00:00Z",
            stopped_at: "2026-01-01T00:01:00Z",
          },
        ],
      } as never);

      expect(workflows[0].jobs.map((job) => job.job_number)).toEqual([124]);

      const tests = await client.fetchWorkflowsTests(workflows);
      expect(tests.map((job) => job.jobNumber)).toEqual([123, 124]);

      const customReports = await client.fetchWorkflowCustomReports(
        workflows[0],
        [{ name: "report", paths: ["reports/*.json"] }] as never,
      );
      expect(customReports).toHaveLength(2);
      expect(
        customReports.map((jobReports) =>
          (jobReports.get("report") ?? []).map((artifact) => artifact.path),
        ),
      ).toEqual([["reports/job-123.json"], ["reports/job-124.json"]]);
    });
  });
});
