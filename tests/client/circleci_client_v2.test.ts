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
  });
});
