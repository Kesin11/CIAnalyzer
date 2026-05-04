import { describe, it, expect, beforeEach, vi } from "vitest";
import AdmZip from "adm-zip";
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

type MockArtifact = {
  id: number;
  name: string;
};

type MockDownloadedArtifactResponse = {
  data: ArrayBuffer;
  headers: Headers;
};

const defaultOptions = new ArgumentOptions({
  c: "./dummy.yaml",
});
const xmlGlobs = ["**/*.xml"];

function createZipArrayBuffer(path: string, content: string): ArrayBuffer {
  const zip = new AdmZip();
  zip.addFile(path, Buffer.from(content));
  const buffer = zip.toBuffer();
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

function createArrayBuffer(content: string): ArrayBuffer {
  const buffer = Buffer.from(content);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

function createMockOctokit(artifacts: MockArtifact[] = []) {
  return {
    log: {
      warn: vi.fn(),
    },
    actions: {
      listWorkflowRuns: vi.fn(),
      listRepoWorkflows: vi.fn(),
      listJobsForWorkflowRun: vi.fn(),
      listWorkflowRunArtifacts: vi.fn(async () => ({
        data: {
          artifacts,
        },
      })),
    },
    repos: {
      listTags: vi.fn(),
    },
    request: vi.fn(async () => ({
      headers: {
        location: "https://example.test/download",
      },
    })),
  } as any;
}

function createGithubClient(
  artifacts: MockArtifact[],
  downloadedArtifact: MockDownloadedArtifactResponse,
): {
  client: GithubClient;
  octokit: ReturnType<typeof createMockOctokit>;
} {
  const octokit = createMockOctokit(artifacts);
  const client = new GithubClient("DUMMY_TOKEN", defaultOptions, undefined, {
    octokit,
    artifactDownloader: vi.fn(async () => downloadedArtifact),
  });

  return {
    client,
    octokit,
  };
}

describe("GithubClient", () => {
  describe("filterWorkflowRuns", () => {
    let client: GithubClient;
    beforeEach(() => {
      client = new GithubClient("DUMMY_TOKEN", defaultOptions);
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
    beforeEach(() => {
      client = new GithubClient("DUMMY_TOKEN", defaultOptions);
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

  describe("fetchArtifacts", () => {
    it("extracts files from zip artifacts", async () => {
      const { client } = createGithubClient(
        [
          {
            id: 1,
            name: "test_results",
          },
        ],
        {
          data: createZipArrayBuffer("reports/junit.xml", "<testsuite />"),
          headers: new Headers({
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="test_results.zip"',
          }),
        },
      );

      const artifacts = await client.fetchArtifacts(
        "owner",
        "repo",
        1,
        xmlGlobs,
      );

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.path).toBe("reports/junit.xml");
    });

    it("treats matching non-zip artifacts as direct files", async () => {
      const { client, octokit } = createGithubClient(
        [
          {
            id: 1,
            name: "artifact",
          },
        ],
        {
          data: createArrayBuffer("<testsuite />"),
          headers: new Headers({
            "content-type": "application/octet-stream",
            "content-disposition": 'attachment; filename="test-results.xml"',
          }),
        },
      );

      const artifacts = await client.fetchArtifacts(
        "owner",
        "repo",
        1,
        xmlGlobs,
      );

      expect(artifacts).toEqual([
        {
          path: "test-results.xml",
          data: expect.any(ArrayBuffer),
        },
      ]);
      expect(octokit.request).toHaveBeenCalledWith(
        "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
        {
          owner: "owner",
          repo: "repo",
          artifact_id: 1,
          archive_format: "zip",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
          request: {
            parseSuccessResponseBody: false,
            redirect: "manual",
          },
        },
      );
      expect(octokit.log.warn).not.toHaveBeenCalled();
    });

    it("skips non-zip artifacts quietly even when headers say zip", async () => {
      const { client, octokit } = createGithubClient(
        [
          {
            id: 1,
            name: "artifact",
          },
        ],
        {
          data: createArrayBuffer("buildkit data"),
          headers: new Headers({
            "content-type": "application/zip",
            "content-disposition":
              'attachment; filename="artifact.dockerbuild.zip"',
          }),
        },
      );

      const artifacts = await client.fetchArtifacts(
        "owner",
        "repo",
        1,
        xmlGlobs,
      );

      expect(artifacts).toEqual([]);
      expect(octokit.log.warn).not.toHaveBeenCalled();
    });

    it("falls back to payload sniffing when zip content-type is missing", async () => {
      const { client } = createGithubClient(
        [
          {
            id: 1,
            name: "artifact",
          },
        ],
        {
          data: createZipArrayBuffer("reports/junit.xml", "<testsuite />"),
          headers: new Headers({
            "content-type": "application/octet-stream",
            "content-disposition": 'attachment; filename="artifact.bin"',
          }),
        },
      );

      const artifacts = await client.fetchArtifacts(
        "owner",
        "repo",
        1,
        xmlGlobs,
      );

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]?.path).toBe("reports/junit.xml");
    });
  });
});
