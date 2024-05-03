import type { AxiosInstance } from "axios";
import { minBy } from "lodash-es";
import {
  type Artifact,
  createAxios,
  type CustomReportArtifact,
} from "./client.js";
import { minimatch } from "minimatch";
import type { CustomReportConfig } from "../config/schema.js";
import type { ArgumentOptions } from "../arg_options.js";
import type { Logger } from "tslog";

const DEBUG_PER_PAGE = 10;
const NOT_FINISHED_STATUS = 0;
const MAX_LIMIT = 50;

// /apps/{app-slug}/builds
// The status of the build: not finished (0), successful (1), failed (2), aborted with failure (3), aborted with success (4)
export type BitriseStatus = 0 | 1 | 2 | 3 | 4;

type AppsResponse = {
  slug: string; // "bc71f23672fbb89c",
  title: string; // "FlutterGettingStarted",
  project_type: string; // "flutter",
  provider: string; // "github",
  repo_owner: string; // "Kesin11",
  repo_url: string; // "https://github.com/Kesin11/FlutterGettingStarted.git",
  repo_slug: string; // "FlutterGettingStarted",
  is_disabled: boolean; // false
  status: number; // 1,
  is_public: boolean; // true
  owner: {
    account_type: string; // "user",
    name: string; // "Kesin11",
    slug: string; // "bd47661b1d369a62"
  };
  avatar_url?: string | null; // null
};

export type App = {
  slug: string;
  fullname: string;
  repo: string;
};

export type BuildResponse = {
  triggered_at: string; // "2020-11-22T09:45:54Z",
  started_on_worker_at: string | null; // "2020-11-22T09:45:55Z",
  environment_prepare_finished_at: string | null; // "2020-11-22T09:45:55Z",
  finished_at: string; // "2020-11-22T09:53:34Z",
  slug: string; // "463a0adea17cd32d",
  status: BitriseStatus; // 2,
  status_text: string; // "error",
  abort_reason: string | null; // null,
  is_on_hold: boolean; // false,
  branch: string; // "master",
  build_number: number; // 9,
  commit_hash: string | null; // null,
  commit_message: string | null; // null,
  tag: string | null; // null,
  triggered_workflow: string; // "primary",
  triggered_by: string | null; // "manual-Kesin11",
  machine_type_id: string; // "standard",
  stack_identifier: string; // "osx-vs4mac-stable",
  original_build_params: {
    branch: string; // "master"
  };
  pull_request_id: number; // 0,
  pull_request_target_branch: string | null; // null,
  pull_request_view_url: string | null; // null,
  commit_view_url: string | null; // null
};

export type BuildLogResponse = {
  expiring_raw_log_url: string;
  generated_log_chunks_num: number; // 42,
  is_archived: boolean; // true,
  log_chunks: {
    chunk: string; // log test
    position: number; // 32
  }[];
  timestamp: null; // null
};

type ArtifactListResponse = {
  title: string; // "Runner.app.zip",
  artifact_type: string; // "file",
  artifact_meta: string | null; // null,
  is_public_page_enabled: boolean; // false,
  slug: string; // "fb1be55b0400fa40",
  file_size_bytes: number; // 10738854
}[];

type ArtifactResponse = {
  title: string; // "flutter_json_test_results.json",
  artifact_type: string; // "file",
  artifact_meta: string | null; // null,
  expiring_download_url: string; // https://bitrise-prod-build-storage.s3.amazonaws.com/builds/...",
  is_public_page_enabled: boolean; // false,
  slug: string; // "6b581c121b295603",
  public_install_page_url: string; // "",
  file_size_bytes: number; // 4914
};

export class BitriseClient {
  #axios: AxiosInstance;
  #artifactAxios: AxiosInstance;
  #options: ArgumentOptions;
  constructor(
    token: string,
    logger: Logger<unknown>,
    options: ArgumentOptions,
    baseUrl?: string,
  ) {
    const axiosLogger = logger.getSubLogger({ name: BitriseClient.name });
    this.#options = options;
    this.#axios = createAxios(axiosLogger, options, {
      baseURL: baseUrl ?? "https://api.bitrise.io/v0.1",
      headers: { Authorization: token },
    });

    this.#artifactAxios = createAxios(axiosLogger, options, {});
  }

  // https://api-docs.bitrise.io/#/application/app-list
  async fetchApps() {
    const res = await this.#axios.get("apps", {
      params: {
        sort_by: "last_build_at",
      },
    });
    const apps = res.data.data as AppsResponse[];
    return apps
      .filter((app) => app.is_disabled === false)
      .map((app) => {
        return {
          slug: app.slug,
          fullname: `${app.repo_owner}/${app.title}`,
          repo: `${app.repo_owner}/${app.repo_slug}`,
        };
      });
  }

  // https://api-docs.bitrise.io/#/builds/build-list
  async fetchBuilds(appSlug: string, lastRunId?: number) {
    const res = await this.#axios.get(`apps/${appSlug}/builds`, {
      params: {
        sort_by: "created_at",
        limit: this.#options.debug ? DEBUG_PER_PAGE : MAX_LIMIT,
      },
    });
    const builds = res.data.data as BuildResponse[];
    return this.filterBuilds(builds, lastRunId);
  }

  // Filter to: lastRunId < Id < firstInprogressId
  filterBuilds(
    rawBuilds: BuildResponse[],
    lastRunId?: number,
  ): BuildResponse[] {
    let builds = lastRunId
      ? rawBuilds.filter((build) => build.build_number > lastRunId)
      : rawBuilds;
    const firstInprogress = minBy(
      builds.filter((build) => build.status === NOT_FINISHED_STATUS),
      (build) => build.build_number,
    );
    builds = firstInprogress
      ? builds.filter(
          (build) => build.build_number < firstInprogress.build_number,
        )
      : builds;
    return builds;
  }

  // https://api-docs.bitrise.io/#/builds/build-log
  async fetchJobLog(
    appSlug: string,
    buildSlug: string,
  ): Promise<BuildLogResponse | null> {
    const res = await this.#axios.get(
      `apps/${appSlug}/builds/${buildSlug}/log`,
      {
        // NOTE: Allow 404 response build that aborted by rolling build and has not build log
        validateStatus: (status) =>
          (status >= 200 && status < 300) || status === 404,
      },
    );
    if (res.status === 404) return null;
    return res.data as BuildLogResponse;
  }

  async fetchTests(appSlug: string, buildSlug: string, globs: string[]) {
    // Skip if test file globs not provided
    if (globs.length < 1) return [];

    const artifactsList = await this.fetchArtifactsList(appSlug, buildSlug);
    const testArtifactsList = artifactsList.filter((artifact) => {
      return globs.some((glob) => minimatch(artifact.title, glob));
    });
    return await this.fetchArtifacts(appSlug, buildSlug, testArtifactsList);
  }

  async fetchArtifactsList(
    appSlug: string,
    buildSlug: string,
  ): Promise<ArtifactListResponse> {
    const res = await this.#axios.get(
      `/apps/${appSlug}/builds/${buildSlug}/artifacts`,
      { params: { limit: MAX_LIMIT } },
    );
    return res.data.data as ArtifactListResponse;
  }

  async fetchArtifacts(
    appSlug: string,
    buildSlug: string,
    artifactList: ArtifactListResponse,
  ): Promise<Artifact[]> {
    const artifactResponses: ArtifactResponse[] = [];
    for (const artifact of artifactList) {
      const res = await this.#axios.get(
        `/apps/${appSlug}/builds/${buildSlug}/artifacts/${artifact.slug}`,
      );
      artifactResponses.push(res.data.data as ArtifactResponse);
    }

    // Fetch artifacts in parallel
    const pathResponses = artifactResponses.map((artifact) => {
      // NOTE: Bitrise store their artifacts to S3.
      // S3 does not accept 'Authorization' header, so using another axios client that is not set Bitrise Authorization header.
      const response = this.#artifactAxios.get(artifact.expiring_download_url, {
        responseType: "arraybuffer",
      });
      return { path: artifact.title, response };
    });

    const artifacts = [];
    for (const { path, response } of pathResponses) {
      artifacts.push({
        path,
        data: (await response).data as ArrayBuffer,
      });
    }
    return artifacts;
  }

  async fetchCustomReports(
    appSlug: string,
    buildSlug: string,
    customReportsConfigs: CustomReportConfig[],
  ): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs?.length < 1) return new Map();

    const artifactsList = await this.fetchArtifactsList(appSlug, buildSlug);

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>();
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      const customArtifaactsList = artifactsList.filter((artifact) => {
        return customReportConfig.paths.some((glob) =>
          minimatch(artifact.title, glob),
        );
      });
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(
          appSlug,
          buildSlug,
          customArtifaactsList,
        ),
      };
    });
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts);
    }

    return customReports;
  }
}
