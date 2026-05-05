import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { CustomReportArtifact, Artifact } from "./artifact.ts";
import { minBy } from "lodash-es";
import { ZipExtractor } from "../zip_extractor.ts";
import type { CustomReportConfig } from "../config/schema.ts";
import type { ArgumentOptions } from "../arg_options.ts";
import {
  detectGithubArtifactFormat,
  resolveGithubArtifactPath,
  toDirectArtifact,
  type GithubArtifactFormat,
} from "./github_artifact.ts";

// Oktokit document: https://octokit.github.io/rest.js/v18#actions

const DEBUG_PER_PAGE = 10;
const GITHUB_API_VERSION = "2022-11-28";

export type WorkflowItem =
  RestEndpointMethodTypes["actions"]["listRepoWorkflows"]["response"]["data"]["workflows"][0];
type WorkflowRunsItem =
  RestEndpointMethodTypes["actions"]["listWorkflowRunsForRepo"]["response"]["data"]["workflow_runs"][0];
// see: https://developer.github.com/v3/checks/runs/#create-a-check-run
type RunStatus = "queued" | "in_progress" | "completed";

export type RepositoryTagMap = Map<string, string>;

type GithubOctokit = Pick<Octokit, "log"> & {
  actions: Pick<
    Octokit["actions"],
    | "listWorkflowRuns"
    | "listRepoWorkflows"
    | "listJobsForWorkflowRun"
    | "listWorkflowRunArtifacts"
  >;
  repos: Pick<Octokit["repos"], "listTags">;
  request: Octokit["request"];
};

type ArtifactDownloadOctokit = Pick<Octokit, "request">;

type DownloadedArtifactResponse = {
  data: ArrayBuffer;
  headers: Headers;
};

type DownloadedArtifact = {
  data: ArrayBuffer;
  format: GithubArtifactFormat;
  path: string;
};

type WorkflowArtifactToDownload = {
  id: number;
  name: string;
};

type ArtifactDownloadUrlResolver = (
  owner: string,
  repo: string,
  artifactId: number,
) => Promise<string>;

type GithubClientDependencies = {
  octokit?: GithubOctokit;
  artifactDownloadOctokit?: ArtifactDownloadOctokit;
  artifactDownloadUrlResolver?: ArtifactDownloadUrlResolver;
};

const isExpiredArtifactError = (
  error: unknown,
): error is { status: number } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 410
  );
};

export class GithubClient {
  #artifactDownloadUrlResolver: ArtifactDownloadUrlResolver;
  #artifactDownloadOctokit: ArtifactDownloadOctokit;
  #octokit: GithubOctokit;
  private options: ArgumentOptions;
  constructor(
    token: string,
    options: ArgumentOptions,
    baseUrl?: string,
    deps: GithubClientDependencies = {},
  ) {
    this.options = options;
    const MyOctokit = Octokit.plugin(throttling, retry);
    this.#octokit =
      deps.octokit ??
      new MyOctokit({
        auth: token,
        baseUrl: baseUrl ?? "https://api.github.com",
        log: options.debug ? console : undefined,
        throttle: {
          onRateLimit: (retryAfter, options, _octokit, retryCount) => {
            this.#octokit.log.warn(
              `Request quota exhausted for request ${options.method} ${options.url}`,
            );
            // Retry twice after hitting a rate limit error, then give up
            if (retryCount <= 2) {
              this.#octokit.log.warn(`Retrying after ${retryAfter} seconds!`);
              return true;
            }
          },
          onSecondaryRateLimit: (
            _retryAfter,
            options,
            _octokit,
            _retryCount,
          ) => {
            // does not retry, only logs a warning
            this.#octokit.log.warn(
              `Abuse detected for request ${options.method} ${options.url}`,
            );
          },
        },
      });
    const RetryableBlobOctokit = Octokit.plugin(retry);
    this.#artifactDownloadOctokit =
      deps.artifactDownloadOctokit ??
      new RetryableBlobOctokit({
        log: options.debug ? console : undefined,
      });
    this.#artifactDownloadUrlResolver =
      deps.artifactDownloadUrlResolver ??
      this.resolveArtifactDownloadUrl.bind(this);
  }

  private async resolveArtifactDownloadUrl(
    owner: string,
    repo: string,
    artifactId: number,
  ): Promise<string> {
    const response = await this.#octokit.request(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}",
      {
        owner,
        repo,
        artifact_id: artifactId,
        archive_format: "zip",
        headers: {
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
        request: {
          parseSuccessResponseBody: false,
          redirect: "manual",
        },
      },
    );

    const location = response.headers.location;
    if (!location) {
      throw new Error(
        `Artifact download URL was missing for ${owner}/${repo} artifact=${artifactId}`,
      );
    }

    return location;
  }

  private toDownloadedArtifact(
    artifactName: string,
    response: DownloadedArtifactResponse,
  ): DownloadedArtifact {
    return {
      data: response.data,
      format: detectGithubArtifactFormat(response.data),
      path: resolveGithubArtifactPath(response.headers, artifactName),
    };
  }

  private async downloadArtifactFromUrl(
    artifactDownloadUrl: string,
  ): Promise<DownloadedArtifactResponse> {
    const { data, headers } = await this.#artifactDownloadOctokit.request(
      `GET ${artifactDownloadUrl}`,
    );
    return {
      data: data as ArrayBuffer,
      headers: new Headers(headers as Record<string, string>),
    };
  }

  private async downloadArtifact(
    owner: string,
    repo: string,
    runId: number,
    artifact: WorkflowArtifactToDownload,
  ): Promise<DownloadedArtifact | undefined> {
    try {
      const { id, name } = artifact;
      const artifactDownloadUrl = await this.#artifactDownloadUrlResolver(
        owner,
        repo,
        id,
      );
      return this.toDownloadedArtifact(
        name,
        await this.downloadArtifactFromUrl(artifactDownloadUrl),
      );
    } catch (error) {
      if (isExpiredArtifactError(error)) {
        this.#octokit.log.warn(
          `Skip expired artifact ${owner}/${repo} run=${runId} artifact=${artifact.name}`,
        );
        return undefined;
      }
      throw error;
    }
  }

  // see: https://developer.github.com/v3/actions/workflow-runs/#list-repository-workflow-runs
  async fetchWorkflowRuns(
    owner: string,
    repo: string,
    workflowId: number,
    lastRunId?: number,
  ) {
    const runs = await this.#octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowId,
      per_page: this.options.debug ? DEBUG_PER_PAGE : 100, // API default is 100
      // page: 1, // order desc
    });

    return this.filterWorkflowRuns(runs.data.workflow_runs, lastRunId);
  }

  // Filter to: lastRunId < Id < firstInprogressId
  filterWorkflowRuns(
    rawRuns: WorkflowRunsItem[],
    lastRunId?: number,
  ): WorkflowRunsItem[] {
    let runs = lastRunId
      ? rawRuns.filter((run) => run.run_number > lastRunId)
      : rawRuns;
    const firstInprogress = minBy(
      runs.filter((run) => (run.status as RunStatus) !== "completed"),
      (run) => run.run_number,
    );
    runs = firstInprogress
      ? runs.filter((run) => run.run_number < firstInprogress.run_number)
      : runs;
    return runs;
  }

  // see: https://developer.github.com/v3/actions/workflows/#list-repository-workflows
  async fetchWorkflows(owner: string, repo: string) {
    const workflows = await this.#octokit.actions.listRepoWorkflows({
      owner,
      repo,
      per_page: 100, // max 100
    });

    return this.filterWorkflows(workflows.data.workflows);
  }

  // Ignore auto generated workflows (e.g. CodeQL)
  filterWorkflows(workflows: WorkflowItem[]): WorkflowItem[] {
    return workflows.filter((workflow) =>
      workflow.path.startsWith(".github/workflows/"),
    );
  }

  // see: https://developer.github.com/v3/actions/workflow-jobs/#list-jobs-for-a-workflow-run
  async fetchJobs(owner: string, repo: string, runId: number) {
    const jobs = await this.#octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      per_page: 100, // max 100
    });
    return jobs.data.jobs;
  }

  async fetchArtifacts(
    owner: string,
    repo: string,
    runId: number,
    globs: string[],
  ): Promise<Artifact[]> {
    const artifactsResponse =
      await this.#octokit.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId,
      });

    // Unarchive zip artifacts
    const zipExtractor = new ZipExtractor();
    try {
      const downloadedArtifacts = await Promise.all(
        artifactsResponse.data.artifacts.map(async (artifact) => {
          const downloadedArtifact = await this.downloadArtifact(
            owner,
            repo,
            runId,
            {
              id: artifact.id,
              name: artifact.name,
            },
          );

          return {
            name: artifact.name,
            downloadedArtifact,
          };
        }),
      );

      const directArtifacts: Artifact[] = [];
      for (const { name, downloadedArtifact } of downloadedArtifacts) {
        if (!downloadedArtifact) continue;

        if (downloadedArtifact.format === "zip") {
          await zipExtractor.put(name, downloadedArtifact.data);
          continue;
        }

        const directArtifact = toDirectArtifact(
          downloadedArtifact.path,
          downloadedArtifact.data,
          globs,
        );
        if (directArtifact) {
          directArtifacts.push(directArtifact);
        }
      }

      const zipEntries = zipExtractor.extract(globs);

      return [
        ...zipEntries.map((entry) => {
          return {
            path: entry.entryName,
            data: entry.getData().buffer.slice(0) as ArrayBuffer,
          };
        }),
        ...directArtifacts,
      ];
    } finally {
      await zipExtractor.rmTmpZip();
    }
  }

  async fetchTests(
    owner: string,
    repo: string,
    runId: number,
    globs: string[],
  ): Promise<Artifact[]> {
    // Skip if test file globs not provided
    if (globs.length < 1) return [];

    return this.fetchArtifacts(owner, repo, runId, globs);
  }

  async fetchCustomReports(
    owner: string,
    repo: string,
    runId: number,
    customReportsConfigs: CustomReportConfig[],
  ): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs.length < 1) return new Map();

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>();
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(
          owner,
          repo,
          runId,
          customReportConfig.paths,
        ),
      };
    });
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts);
    }

    return customReports;
  }

  async fetchRepositoryTagMap(
    owner: string,
    repo: string,
  ): Promise<RepositoryTagMap> {
    try {
      const res = await this.#octokit.repos.listTags({
        owner,
        repo,
        per_page: 100,
      });
      const tags = res.data;
      return new Map(tags.map((tag) => [tag.commit.sha, tag.name]));
    } catch (error) {
      console.warn(`Failed to fetch ${owner}/${repo} tags.`);
      console.warn(`${owner}/${repo} can not include tag data into report.`);
      console.warn(error);
      return new Map();
    }
  }
}
