import { describe, it, expect, beforeEach } from "vitest";
import { ArgumentOptions } from "../../src/arg_options.ts";
import { GithubClient } from "../../src/client/github_client.ts";

const allCompletedRuns = [
  { run_number: 2, status: "completed" },
  { run_number: 3, status: "completed" },
  { run_number: 4, status: "completed" },
  { run_number: 5, status: "completed" },
  { run_number: 6, status: "completed" },
] as any;

const hasInprogressRuns = [
  { run_number: 2, status: "completed" },
  { run_number: 3, status: "completed" },
  { run_number: 4, status: "in_progress" },
  { run_number: 5, status: "in_progress" },
  { run_number: 6, status: "completed" },
] as any;

const hasQueuedRuns = [
  { run_number: 2, status: "completed" },
  { run_number: 3, status: "completed" },
  { run_number: 4, status: "queued" },
  { run_number: 5, status: "queued" },
  { run_number: 6, status: "completed" },
] as any;

describe("GithubClient", () => {
  describe("filterWorkflowRuns", () => {
    let client: GithubClient;
    const options = new ArgumentOptions({
      c: "./dummy.yaml",
    });
    beforeEach(() => {
      client = new GithubClient("DUMMY_TOKEN", options);
    });

    it("when lastRunId is undef and has not in_pregress runs", async () => {
      const lastRunId = undefined;
      const actual = client.filterWorkflowRuns(allCompletedRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([2, 3, 4, 5, 6]);
    });

    it("when defined lastRunId and has not in_pregress runs", async () => {
      const lastRunId = 2;
      const actual = client.filterWorkflowRuns(allCompletedRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([3, 4, 5, 6]);
    });

    it("when lastRunId is undef and has in_pregress runs", async () => {
      const lastRunId = undefined;
      const actual = client.filterWorkflowRuns(hasInprogressRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([2, 3]);
    });

    it("when defined lastRunId and has in_pregress runs", async () => {
      const lastRunId = 2;
      const actual = client.filterWorkflowRuns(hasInprogressRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([3]);
    });

    it("when lastRunId is undef and has queued runs", async () => {
      const lastRunId = undefined;
      const actual = client.filterWorkflowRuns(hasQueuedRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([2, 3]);
    });

    it("when defined lastRunId and has queued runs", async () => {
      const lastRunId = 2;
      const actual = client.filterWorkflowRuns(hasQueuedRuns, lastRunId);

      expect(actual.map((run) => run.run_number)).toEqual([3]);
    });
  });

  describe("filterWorkflows", () => {
    let client: GithubClient;
    const options = new ArgumentOptions({
      c: "./dummy.yaml",
    });
    beforeEach(() => {
      client = new GithubClient("DUMMY_TOKEN", options);
    });

    it("when workflows have CodeQL workflow", async () => {
      const workflows = [
        { name: "Release", path: ".github/workflows/release.yml" },
        { name: "CodeQL", path: "dynamic/github-code-scanning/codeql" },
      ] as any;
      const actual = client.filterWorkflows(workflows);

      expect(actual).toStrictEqual([
        { name: "Release", path: ".github/workflows/release.yml" },
      ]);
    });

    it("when all workflows are user generated", async () => {
      const workflows = [
        { name: "Release", path: ".github/workflows/release.yml" },
        { name: "Test", path: ".github/workflows/test.yml" },
      ] as any;
      const actual = client.filterWorkflows(workflows);

      expect(actual).toStrictEqual([
        { name: "Release", path: ".github/workflows/release.yml" },
        { name: "Test", path: ".github/workflows/test.yml" },
      ]);
    });
  });
});
