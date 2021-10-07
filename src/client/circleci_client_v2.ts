import path from 'path'
import minimatch from 'minimatch'
import { AxiosInstance } from 'axios'
import { minBy } from 'lodash'
import { Artifact, CustomReportArtifact, createAxios } from './client'
import { CustomReportConfig } from '../config/config'
import { ArgumentOptions } from '../arg_options'
import { Logger } from 'tslog'
import { failure, Result, success } from '../result'
import { CircleciStatus } from './circleci_client'
import { Overwrite } from 'utility-types'

const DEBUG_FETCH_LIMIT = 5
const FETCH_LIMIT = 100

type V2ApiResponse = {
  items: unknown[],
  next_page_token: string | null
}

type ListPipelinesForProjectResponse = {
  items: {
    id: string, // "f9bc9389-26a6-411f-9ad4-abda516625f3",
    errors: {
      type: "config" | "plan",
      message: string
    }[],
    project_slug: string, // "gh/Kesin11/CIAnalyzer",
    updated_at?: string, // "2021-08-29T17:27:13.320Z",
    number: number, // 1133,
    state: "created" | "errored" | "setup-pending" | "setup" | "pending",
    created_at: string, // "2021-08-29T17:27:13.320Z",
    trigger: {
      received_at: string, // "2021-08-29T17:27:13.120Z",
      type: "explicit" | "api" | "webhook",
      actor: {
        login: string, // "renovate[bot]",
        avatar_url: string | null, // null
      }
    },
    vcs: {
      origin_repository_url: string, // "https://github.com/Kesin11/CIAnalyzer",
      target_repository_url: string, // "https://github.com/Kesin11/CIAnalyzer",
      revision: string, // "c069387dac988ac5f778c9f189c5aaa46d2809f8",
      provider_name: string, // "GitHub",
      commit: {
        body: string, // "",
        subject: string, //"chore(deps): update dependency jest to v27.1.0"
      } | undefined,
      branch?: string, // "renovate/jest-packages"
      tag?: string
      review_id?: string,
      review_url?: string,
    }
  }[],
  next_page_token: string | null
}

type ListWorkflowsByPipelineIdResponse = {
  items: {
    pipeline_id : string, // "5a99319f-67b2-4273-8ff3-4f04af90552b",
    canceled_by?: string,
    id : string, // "a8b7b739-bfb8-4bfc-aa29-cab8b2b07b9f",
    name : string, // "docker",
    project_slug : string, // "gh/Kesin11/CIAnalyzer",
    status : "success" | "running" | "not_run" | "failed" | "error" | "failing" | "on_hold" | "canceled" | "unauthorized",
    started_by : string, // "0989fcb2-c8d2-43ed-bfdd-3ff63487e121",
    pipeline_number : number, // 1152,
    created_at : string, // "2021-09-04T19:59:05Z",
    stopped_at : string, // "2021-09-04T19:59:57Z"
  }[],
  next_page_token: string | null
}

export type Pipeline = ListPipelinesForProjectResponse["items"][0]
  & { workflows: ListWorkflowsByPipelineIdResponse["items"] }

type ListWorkflowJobsResponse = {
  items : {
    canceled_by? : string,
    dependencies : string[], // [],
    job_number? : number, // 3405,
    id : string, // "d70a655a-57d7-4a7f-b177-34332f4c7355",
    started_at? : string | null, // "2021-09-04T19:59:11Z",
    name : string, //"lint",
    approved_by?: string,
    project_slug : string,// "gh/Kesin11/CIAnalyzer",
    status : "success" | "failed" | "blocked" // NOTE: API document says 'any' type but I found enum.
    type : "build" | "approval",
    stopped_at? : string, // "2021-09-04T19:59:30Z"
    approval_request_id?: string,
  }[],
  next_page_token: string | null,
}

type FilteredWorkflowJob = Overwrite<
  ListWorkflowJobsResponse["items"][0],
  { job_number: number, started_at: string}
>

type GetJobDetailsResponse = {
  web_url : string, // "https://circleci.com/gh/Kesin11/CIAnalyzer/3405",
  project : {
    external_url : string, // "https://github.com/Kesin11/CIAnalyzer",
    slug : string, // "gh/Kesin11/CIAnalyzer",
    name : string, // "CIAnalyzer"
  },
  parallel_runs : {
    index : number, // 0,
    status : string, // "success"
  }[],
  started_at : string, // "2021-09-04T19:59:11.975Z",
  latest_workflow : {
    name : string, // "ci",
    id : string, // "0a7edade-5785-406a-9c31-3fce94cddad4"
  },
  name : string, // "lint",
  executor : {
    resource_class : string, // "medium",
    type : string, // "docker"
  },
  parallelism : number, // 1,
  status : string, // "success",
  number : number, // 3405,
  pipeline : {
    id : string, // "5a99319f-67b2-4273-8ff3-4f04af90552b"
  },
  duration : number, // 18371,
  created_at : string, // "2021-09-04T19:59:06.288Z",
  messages : { // []
    type: string,
    message: string,
    reason?: string,
  }[],
  contexts : { // []
    name: string,
  }[],
  organization : {
    name : string, // "Kesin11"
  },
  queued_at : string, // "2021-09-04T19:59:06.400Z",
  stopped_at? : string, // "2021-09-04T19:59:30.346Z"
}

export type Workflow = ListWorkflowsByPipelineIdResponse["items"][0]
  & { jobs: Job[] }

type Job = FilteredWorkflowJob
    & { detail: GetJobDetailsResponse, steps: Step[] }

type Step = {
  name: string
  actions: {
    name: string
    status: CircleciStatus
    end_time: string | null, // Sometimes step log will be broken and return null
    start_time: string,
    step: number,
    run_time_millis: number | null, // Sometimes step log will be broken and return null
    background: boolean,
  }[]
}

type v1_1SingleJobResponse = {
  build_num: number,
  steps: Step[]
}

type TestResponse = {
  items: {
    name : string, // "successCount = 1 when testcase is success",
    file : string | null, // null
    classname : string, // "Analyzer convertToReportTestSuites Add testcase.successCount",
    result : string, // "success",
    run_time : number, // 0.0,
    message : string | null, // null,
    source : string, // "unknown"
  }[]
  next_page_token: string | null,
}

export type JobTest = {
  tests: TestResponse["items"]
  jobNumber: number
}

type ArtifactsResponse = {
  items: {
    path : string, // "custom_report.json",
    node_index : number, // 0,
    url : string, // "https://3587-259687475-gh.circle-artifacts.com/0/custom_report.json"
  }[]
  next_page_token: string | null,
}

type ArtifactItem = ArtifactsResponse["items"][0]

export class CircleciClientV2 {
  private axios: AxiosInstance
  private baseUrl: string
  constructor(token: string, logger: Logger, private options: ArgumentOptions, baseUrl?: string) {
    if (baseUrl && path.basename(baseUrl) !== 'api') {
      throw `${CircleciClientV2.name} accepts only "/api/" But your baseUrl is ${baseUrl}`
    }
    const axiosLogger = logger.getChildLogger({ name: CircleciClientV2.name })
    this.baseUrl = baseUrl ?? 'https://circleci.com/api',
    this.axios = createAxios(axiosLogger, {
      baseURL: this.baseUrl,
      auth: {
        username: token,
        password: '',
      },
    })
  }

  async isHostAvailableVersion(): Promise<Result<unknown, Error>> {
    try {
      await this.axios.get( `v2/me`, {
        validateStatus: (status) => {
          return (status >= 200 && status < 300) // default
            || status === 401 // It means endpoint of API v2 is exists.
        }
      })
    } catch (error) {
      return failure(new Error(`${this.baseUrl} unavailable API v2`))
    }

    return success(`${this.baseUrl} available API v2`)
  }

  private async fetchV2Api<T extends V2ApiResponse>(url: string, requestParams?: {[key: string]: unknown}): Promise<T["items"]> {
      const items: T["items"] = []
      for (let pageToken = undefined; pageToken !== null;) {
        const res = await this.axios.get(url, {
          params: {
            ...requestParams,
            "page-token": pageToken,
          }
        })
        const data = res.data as T
        items.push(...data.items)
        pageToken = data.next_page_token
      }
      return items
  }

  // https://circleci.com/docs/api/v2/#operation/listPipelines
  // https://circleci.com/docs/api/v2/#operation/listWorkflowsByPipelineId
  async fetchWorkflowRuns(owner: string, repo: string, vcsType: string, lastRunId?: number): Promise<Pipeline[]> {
    const limit = (this.options.debug) ? DEBUG_FETCH_LIMIT : FETCH_LIMIT
    let recentPipelines = [] as ListPipelinesForProjectResponse["items"]
    for (let length = 0, pageToken = undefined; length < limit;) {
      const res = await this.axios.get( `v2/project/${vcsType}/${owner}/${repo}/pipeline`, {
        params: {
          "page-token": pageToken,
        }
      })
      const data = res.data as ListPipelinesForProjectResponse
      recentPipelines.push(...data.items)
      length = recentPipelines.length
      pageToken = data.next_page_token
    }
    recentPipelines = (this.options.debug)
      ? recentPipelines.slice(0, DEBUG_FETCH_LIMIT)
      : recentPipelines.slice(0, FETCH_LIMIT)

    recentPipelines = (lastRunId)
      ? recentPipelines.filter((pipeline) => pipeline.number > lastRunId)
      : recentPipelines
    
    const pipelines = [] as Pipeline[]
    for (const recentPipeline of recentPipelines) {
      const workflows = await this.fetchV2Api<ListWorkflowsByPipelineIdResponse>(`v2/pipeline/${recentPipeline.id}/workflow`)
      pipelines.push({ ...recentPipeline, workflows: workflows })
    }

    return this.filterPipelines(pipelines)
  }

  // Filter pipelines with last build number < first running build number
  // And also ignore still running pipelines.
  private filterPipelines (pipelines: Pipeline[]): Pipeline[] {
    // Ignore pipeline that has not any workflows.
    // Ignore pipeline that has 'not_run' status workflows that are [ci-skip] commit OR skipped redundant build.
    pipelines = pipelines.filter((pipeline) => {
      return pipeline.workflows.length > 0
        && !pipeline.workflows.some((workflow) => workflow.status === 'not_run')
    })

    const inprogressPipeline = pipelines.filter((pipeline) => {
      return pipeline.workflows.every((workflow) => workflow.status === 'running')
    })
    const firstInprogress = minBy(
      inprogressPipeline,
      (pipeline) => pipeline.number,
    )
    pipelines = (firstInprogress)
      ? pipelines.filter((pipeline) => pipeline.number < firstInprogress.number)
      : pipelines
    return pipelines
  }

  async fetchPipelineWorkflows(pipeline: Pipeline): Promise<Workflow[]> {
    const workflows: Workflow[] = []
    for (const workflow of pipeline.workflows) {
      const jobResponses = await this.fetchWorkflowJobs(workflow.id)
      // Filter jobs that has not job_number
      const filterdWorkflowJobs = jobResponses.filter((jobResponse) => {
        return jobResponse.status !== "blocked"
          && jobResponse.job_number !== undefined
      }) as FilteredWorkflowJob[]

      // Fetch jobDetail and steps in parallel and then Combine to job
      const jobDetails = await Promise.all(filterdWorkflowJobs.map((workflowJob) => {
        return this.fetchJob(workflowJob.job_number, workflowJob.project_slug)
      }))
      const jobSteps = await Promise.all(filterdWorkflowJobs.map((workflowJob) => {
        return this.fetchJobSteps(workflowJob.job_number, workflowJob.project_slug)
      }))
      const jobs: Job[] = filterdWorkflowJobs.map((workflowJobs) => {
        return {
          ...workflowJobs,
          detail: jobDetails.find((detail) => detail.number === workflowJobs.job_number)!,
          steps: jobSteps.find((step) => step.build_num === workflowJobs.job_number)?.steps ?? [],
        }
      })

      workflows.push({ ...workflow, jobs })
    }

    return workflows
  }

  // https://circleci.com/docs/api/v2/#operation/listWorkflowJobs
  private async fetchWorkflowJobs(workflowId: string) {
    const jobs = await this.fetchV2Api<ListWorkflowJobsResponse>(`v2/workflow/${workflowId}/job`)
    return jobs
  }

  // https://circleci.com/docs/api/v2/#operation/getJobDetails
  private async fetchJob(jobNumber: number, projectSlug: string) {
    const res = await this.axios.get( `v2/project/${projectSlug}/job/${jobNumber}`, {})
    return res.data as GetJobDetailsResponse
  }


  // https://circleci.com/docs/api/v1/#single-job
  private async fetchJobSteps(jobNumber: number, projectSlug: string) {
    const res = await this.axios.get( `v1.1/project/${projectSlug}/${jobNumber}`, {})
    return res.data as v1_1SingleJobResponse
  }

  async fetchWorkflowsTests(workflows: Workflow[]): Promise<JobTest[]> {
    const jobs = workflows.flatMap((workflow) => workflow.jobs)
    return Promise.all(jobs.map((job) => {
      return this.fetchTests(job.job_number, job.project_slug)
    }))
  }

  // https://circleci.com/docs/api/v2/#operation/getTests
  async fetchTests(jobNumber: number, projectSlug: string): Promise<JobTest> {
    const tests = await this.fetchV2Api<TestResponse>(`v2/project/${projectSlug}/${jobNumber}/tests`)
    return { tests, jobNumber }
  }

  async fetchWorkflowCustomReports(workflow: Workflow, customReportConfigs: CustomReportConfig[]) {
    return await Promise.all(workflow.jobs.map((job) => {
      return this.fetchCustomReports(job.job_number, job.project_slug, customReportConfigs)
    }))
  }

  private async fetchCustomReports(jobNumber: number, projectSlug: string, customReportsConfigs: CustomReportConfig[]): Promise<CustomReportArtifact> {
    // Skip if custom report config are not provided
    if (customReportsConfigs?.length < 1) return new Map()

    const artifacts = await this.fetchArtifactsList(jobNumber, projectSlug)

    // Fetch artifacts in parallel
    const customReports: CustomReportArtifact = new Map<string, Artifact[]>()
    const nameArtifacts = customReportsConfigs.map((customReportConfig) => {
      const reportArtifacts = artifacts.filter((artifact) => {
        return customReportConfig.paths.some((glob) => minimatch(artifact.path, glob))
      })
      return {
        name: customReportConfig.name,
        artifacts: this.fetchArtifacts(reportArtifacts)
      }
    })
    for (const { name, artifacts } of nameArtifacts) {
      customReports.set(name, await artifacts)
    }

    return customReports
  }

  // https://circleci.com/docs/api/v2/#operation/getJobArtifacts
  private async fetchArtifactsList(jobNumber: number, projectSlug: string): Promise<ArtifactItem[]> {
    const artifacts = await this.fetchV2Api<ArtifactsResponse>(`v2/project/${projectSlug}/${jobNumber}/artifacts`)
    return artifacts
  }

  private async fetchArtifacts(artifactItems: ArtifactItem[]): Promise<Artifact[]> {
    const pathResponses = artifactItems.map((artifactItem) => {
      const response = this.axios.get(
        artifactItem.url,
        { responseType: 'arraybuffer'}
      )
      return { path: artifactItem.path, response }
    })

    const artifacts = []
    for (const { path, response } of pathResponses) {
      artifacts.push({
        path,
        data: (await response).data as ArrayBuffer
      })
    }
    return artifacts
  }
}
