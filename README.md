# CIAnalyzer
[![CI](https://github.com/Kesin11/CIAnalyzer/workflows/CI/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker build](https://github.com/Kesin11/CIAnalyzer/workflows/Docker%20build/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker Pulls](https://img.shields.io/badge/docker%20pulls-ghcr.io-blue)](https://github.com/users/Kesin11/packages/container/ci_analyzer/versions)
[![Docker Pulls](https://img.shields.io/docker/pulls/kesin/ci_analyzer)](https://hub.docker.com/r/kesin/ci_analyzer)

CIAnalyzer is a tool for collecting build data from CI services. You can create a dashboard to analyze your build from the collected data.

# Motivation
Today, many CI services provide the ability to build applications, docker images, and many other things.
Since some of these builds can take a long time to build, you may want to analyze your build data, average build time, success rate, etc.

Unfortunately, few services provide a dashboard for analyzing build data. As far as I know Azure Pipeline provides a great feature called [Pipeline reports](https://docs.microsoft.com/en-us/azure/devops/pipelines/reports/pipelinereport?view=azure-devops), but it only shows data about builds that have been run in Azure Pipeline.

CIAnalyzer collects build data using each service API, then normalizes the data format and exports it. So you can create a dashboard that allows you to analyze build data across multiple CI services using your favorite BI tools.

# Sample dashboard
[CIAnalyzer sample dashboard (DataStudio)](https://datastudio.google.com/reporting/71454c60-96f9-47e0-8dc6-2d5f98b60609/page/11yEB)

It created by DataStudio with BigQuery
![ci_analyzer_dashboard1](https://user-images.githubusercontent.com/1324862/82752752-3d5bcd00-9dfb-11ea-9cb3-a32e81c5f3b9.png)
![ci_analyzer_dashboard2](https://user-images.githubusercontent.com/1324862/82752755-42b91780-9dfb-11ea-91df-c3451e51772a.png)
![cianalyzer_test_report](https://user-images.githubusercontent.com/1324862/89435621-15380500-d780-11ea-8131-5dde21beb3fa.png)

# Architecture
![CIAnalyzer Architecture](https://user-images.githubusercontent.com/1324862/128656632-de08a369-4c71-4e91-9084-626396f42a03.png)


# Export data
## Workflow
Workflow is a data about job that executed in CI. The items included in the workflow data are as follows.

- Executed date
- Duration time
- Status(Success, Failed, Abort, etc.)
- Build number
- Trigger type
- Repository
- Branch
- Tag
- Queued time
- Commit
- Actor
- Workflow URL
- Executor data

See full schema: [workflow.proto](./proto/workflow.proto)

## Test report
Test report is a data about test. If you output test result as JUnit format XML and store to archive, CIAnalyzer can collect from it.

- Executed date
- Duration time
- Status(Success, Failed, Skipped, etc.)
- Test name
- Number of test
- Failure test num
- Branch

See full schema: [test_report.proto](./proto/test_report.proto)

# Supported services
- CI services
  - GitHub Actions
  - CircleCI (also support enterprise version)
  - Jenkins (only Pipeline job)
    - Collecting some metrics need to install these plugins
    - [GitHub Pull Request Builder](https://plugins.jenkins.io/ghprb/)
    - [Metrics](https://plugins.jenkins.io/metrics/)
  - Bitrise
- Export
  - BigQuery
  - Local file (output JSON or JSON Lines)
  - Google Cloud Storage (GCS)

# USAGE
```bash
docker run \
  --mount type=bind,src=${PWD},dst=/app/ \
  --mount type=bind,src=${SERVICE_ACCOUNT},dst=/service_account.json \
  -e GITHUB_TOKEN=${GITHUB_TOKEN} \
  -e CIRCLECI_TOKEN=${CIRCLECI_TOKEN} \
  -e JENKINS_USER=${JENKINS_USER} \
  -e JENKINS_TOKEN=${JENKINS_TOKEN} \
  -e BITRISE_TOKEN=${BITRISE_TOKEN} \
  -e GOOGLE_APPLICATION_CREDENTIALS=/service_account.json \
  ghcr.io/kesin11/ci_analyzer:v5 -c ci_analyzer.yaml
```

## Container tagging scheme
The versioning follows [Semantic Versioning](https://semver.org/):

> Given a version number MAJOR.MINOR.PATCH, increment the:
>
> 1. MAJOR version when you make incompatible API changes,
> 2. MINOR version when you add functionality in a backwards-compatible manner, and
> 3. PATCH version when you make backwards-compatible bug fixes.

Most recommend tag for user is `v{major}`. If you prefere more conservetive versioning, `v{major}.{minor}` or `v{major}.{minor}.{patch}` are recommended.

|tag|when update|for|
|----|----|----|
|`v{major}`|Create release|User|
|`v{major}.{minor}`|Create release|User|
|`v{major}.{minor}.{patch}`|Create release|User|
|`latest`|Create release|Developer|
|`master`|Push master|Developer|


## Setup ENV
- Services
  - GITHUB_TOKEN: GitHub auth token
  - CIRCLECI_TOKEN: CircleCI API token
  - JENKINS_USER: Username for login to your Jenkins
  - JENKINS_TOKEN: Jenkins user API token
  - BITRISE_TOKEN: Bitrise personal access token
- Exporter
  - GOOGLE_APPLICATION_CREDENTIALS: GCP service account json path
- LastRunStore
  - GOOGLE_APPLICATION_CREDENTIALS

## Setup Exporter
### Setup BigQuery table (Recommend)
> [!IMPORTANT]
> If you want to use `exporter.bigquery`, you have to create dataset and table that CIAnalyzer will export data to it.

```bash
# Prepare bigquery schema json files
git clone https://github.com/Kesin11/CIAnalyzer.git
cd CIAnalyzer

# Create dataset
bq mk \
  --project_id=${GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --dataset \
  ${DATASET}

# Create tables
bq mk \
  --project_id=${GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${WORKFLOW_TABLE} \
  ./bigquery_schema/workflow_report.json

bq mk \
  --project_id=${GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TEST_REPORT_TABLE} \
  ./bigquery_schema/test_report.json
```

And also GCP service account used for CIAnalyzer needs some BigQuery permissions. Please attach `roles/bigquery.dataEditor` and `roles/bigquery.jobUser`. More detail, check [BigQuery access control document](https://cloud.google.com/bigquery/docs/access-control).

### Setup GCS
> [!IMPORTANT]
> If you want to use `exporter.gcs`, you have to create a bucket that CIAnalyzer will export data to.

BigQuery can also read JSONL formatted data stored in GCS as [external tables](https://cloud.google.com/bigquery/docs/external-data-cloud-storage), so it is useful to save data to GCS instead of exporting directly to a BigQuery table. In that case, it is recommended to save data in a path that includes the DATE to be recognized as a Hive partition for efficient querying from BigQuery.

see: https://cloud.google.com/bigquery/docs/hive-partitioned-queries

CIAnalyzer can save data to a path with date partitions by specifying a `prefixTemplate` in the configuration file as follows:

```yaml
exporter:
  gcs:
    project: $GCP_PROJECT_ID
    bucket: $BUCKET_NAME
    prefixTemplate: "ci_analyzer/{reportType}/dt={YYYY}-{MM}-{DD}/"
```

## Setup LastRunStore
### What is LastRunStore
CIAnalyzer collects build data from each CI service API, but there may be duplicates of the previously collected data. To remove the duplicate, it is necessary to save the last build number of the previous run and output only the difference from the previous run.

After CIAnalyzer collects build data successfully, it save each job build number and load before next time execution. This feature called LastRunStore.

By default, CIAnalyzer uses a local JSON file as a backend for LastRunStore. However, the last build number needs to be shared, for example when running CIAnalyzer on Jenkins which uses multiple nodes.

Resolving these problems, CIAnalyzer can use GCS as LastRunStore to read/write the last build number from any machine. It inspired by [Terraform backend](https://www.terraform.io/docs/backends/index.html).

### Setup GCS bucket (Recommend)
> [!IMPORTANT]
> If you want to use `lastRunStore.backend: gcs`, you have to create GCS bucket before execute CIAnalyzer.

```bash
gsutil mb -b on -l ${LOCATION} gs://${BUCKET_NAME}
```

And also GCP service account needs to read and write permissions for the target bucket. More detail, check [GCS access control document](https://cloud.google.com/storage/docs/access-control/iam-permissions).

## Edit config YAML
Copy [ci_analyzer.yaml](./ci_analyzer.yaml) and edit to your preferred configuration. CIAnalyzer uses `ci_analyzer.yaml` as config file in default, but it can change with `-c` options.

Also you don't forget copy Line 1 magic comment. You can given validating and completion support from [vscode-yaml](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) extension!

```
# yaml-language-server: $schema=https://raw.githubusercontent.com/Kesin11/CIAnalyzer/master/schema.json
```

More detail for config file, please check [ci_analyzer.yaml](./ci_analyzer.yaml) and [sample files](./sample).

## Execute on CI service with cron (Recommend)
CIAnalyzer is designed as a tool that runs every time, not as an agent. It's a  good idea to run it with cron on CI services such as CircleCI or Jenkins.

Please check [sample](./sample/README.md), then copy it and edit to your configuration.

## Sample output JSON

### Workflow report

```json
{
  "service": "circleci",
  "workflowId": "Kesin11/CIAnalyzer-ci",
  "buildNumber": 306,
  "workflowRunId": "Kesin11/CIAnalyzer-ci-306",
  "workflowName": "ci",
  "createdAt": "2020-05-21T01:08:06.800Z",
  "trigger": "github",
  "status": "SUCCESS",
  "repository": "Kesin11/CIAnalyzer",
  "headSha": "09f1d6d398c108936ff7973139fcbf1793d74f8f",
  "branch": "master",
  "tag": "v0.2.0",
  "startedAt": "2020-05-21T01:08:09.632Z",
  "completedAt": "2020-05-21T01:08:53.469Z",
  "workflowDurationSec": 40.752,
  "sumJobsDurationSec": 39.959,
  "successCount": 1,
  "parameters": [],
  "jobs": [
    {
      "workflowRunId": "Kesin11/CIAnalyzer-ci-306",
      "buildNumber": 306,
      "jobId": "24f03e1a-1699-4237-971c-ebc6c9b19baa",
      "jobName": "build_and_test",
      "status": "SUCCESS",
      "startedAt": "2020-05-21T01:08:28.347Z",
      "completedAt": "2020-05-21T01:08:53.469Z",
      "jobDurationSec": 25.122,
      "sumStepsDurationSec": 24.738,
      "steps": [
        {
          "name": "Spin Up Environment",
          "status": "SUCCESS",
          "number": 0,
          "startedAt": "2020-05-21T01:08:28.390Z",
          "completedAt": "2020-05-21T01:08:30.710Z",
          "stepDurationSec": 2.32
        },
        {
          "name": "Preparing Environment Variables",
          "status": "SUCCESS",
          "number": 99,
          "startedAt": "2020-05-21T01:08:30.956Z",
          "completedAt": "2020-05-21T01:08:30.984Z",
          "stepDurationSec": 0.028
        },
        {
          "name": "Checkout code",
          "status": "SUCCESS",
          "number": 101,
          "startedAt": "2020-05-21T01:08:30.993Z",
          "completedAt": "2020-05-21T01:08:31.502Z",
          "stepDurationSec": 0.509
        },
        {
          "name": "Restoring Cache",
          "status": "SUCCESS",
          "number": 102,
          "startedAt": "2020-05-21T01:08:31.509Z",
          "completedAt": "2020-05-21T01:08:32.737Z",
          "stepDurationSec": 1.228
        },
        {
          "name": "npm ci",
          "status": "SUCCESS",
          "number": 103,
          "startedAt": "2020-05-21T01:08:32.747Z",
          "completedAt": "2020-05-21T01:08:37.335Z",
          "stepDurationSec": 4.588
        },
        {
          "name": "Build",
          "status": "SUCCESS",
          "number": 104,
          "startedAt": "2020-05-21T01:08:37.341Z",
          "completedAt": "2020-05-21T01:08:43.371Z",
          "stepDurationSec": 6.03
        },
        {
          "name": "Test",
          "status": "SUCCESS",
          "number": 105,
          "startedAt": "2020-05-21T01:08:43.381Z",
          "completedAt": "2020-05-21T01:08:53.369Z",
          "stepDurationSec": 9.988
        },
        {
          "name": "Save npm cache",
          "status": "SUCCESS",
          "number": 106,
          "startedAt": "2020-05-21T01:08:53.376Z",
          "completedAt": "2020-05-21T01:08:53.423Z",
          "stepDurationSec": 0.047
        }
      ]
    }
  ]
}
```

### Test report
```json
[
  {
    "workflowId": "Kesin11/CIAnalyzer-CI",
    "workflowRunId": "Kesin11/CIAnalyzer-CI-170",
    "buildNumber": 170,
    "workflowName": "CI",
    "createdAt": "2020-08-09T10:20:28.000Z",
    "branch": "feature/fix_readme_for_v2",
    "service": "github",
    "status": "SUCCESS",
    "successCount": 1,
    "testSuites": {
      "name": "CIAnalyzer tests",
      "tests": 56,
      "failures": 0,
      "time": 9.338,
      "testsuite": [
        {
          "name": "__tests__/analyzer/analyzer.test.ts",
          "errors": 0,
          "failures": 0,
          "skipped": 0,
          "timestamp": "2020-08-09T10:22:18",
          "time": 3.688,
          "tests": 17,
          "testcase": [
            {
              "classname": "Analyzer convertToReportTestSuites Omit some properties",
              "name": "testcase.error",
              "time": 0.003,
              "successCount": 1,
              "status": "SUCCESS"
            },
            {
              "classname": "Analyzer convertToReportTestSuites Omit some properties",
              "name": "testcase.failure",
              "time": 0,
              "successCount": 1,
              "status": "SUCCESS"
            },
    ...
```

# Collect and export any JSON from build artifacts
You can export any data related to build with `CustomReport`. CIAanalyzer can collect JSON file that has any structure from CI build artifacts. If you want to collect some data and export it to BigQuery(or others), just create JSON that includes your preferred data and store it to CI build artifacts.

## 1. Create schema file for your CustomReport table
Create BigQuery schema JSON like this [sample schema json](./bigquery_schema/custom_sample.json) and save it to any path you want.

These columns are must need in your schema:

|name|type|
|----|----|
|workflowId|STRING|
|workflowRunId|STRING|
|createdAt|TIMESTAMP|

## 2. Create BigQuery table
As introduced before in "Setup BigQuery", create BigQuery table using `bq mk` command like this.

```
bq mk
  --project_id=${YOUR_GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TABLE} \
  /path/to/your/custom_report_schema.json
```

## 3. Add CustomReport config
Add your CustomReport JSON path (import target) at each repo(job)'s artifacts and BigQuery table info (export target) to your config YAML.

See sample [ci_analyzer.yaml](./ci_analyzer.yaml).


`bigquery.customReports[].schema` is BigQuery schema JSON created at step1. It accepts absolute path or relative path from your config YAML.

> [!WARNING]
> When you run CIAnalyzer using docker, `bigquery.customReports[].schema` is a path that **inside of CIAnalyzer docker container**. So it's very confusing and recommends it to mount custom schema JSON at the same path as your ci_analyzer.yaml in the next step.

## 4. Mount custom schema JSON at `docker run` (Only using docker)
To load your custom schema JSON from CIAnalyzer that runs inside of container, you have to also mount your JSON with additional `docker run --mount` options if you need.

```
--mount type=bind,src=${CUSTOM_SCHEMA_DIR_PATH},dst=/app/custom_schema
```

See sample [cron.jenkinsfile](./sample/cron.jenkinsfile).

# Roadmap and features
- Supported CI services
  - [x] GitHub Actions
  - [x] CircleCI API v2
  - [x] Bitrise
  - [x] Jenkins
- Supported data
  - [x] Workflow, Job
  - [x] Test data (JUnit format)
  - [x] Any of JSON format from build artifacts
- Supported exporters
  - [x] Local file
  - [x] BigQuery
  - [x] Google Cloud Storage
  - [ ] S3/S3 compatible storage
- Supported LastRunStore
  - [x] Local file
  - [x] Google Cloud Storage
  - [ ] S3/S3 compatible storage

# Debug options
- Fetch only selected service
  - `--only-services`
  - ex: `--only-services github circleci`
- Using only selected exporters
  - `--only-exporters`
  - ex: `--only-exporters local`
- Enable debug mode
  - `--debug`
  - Limit fetching build results only 10 by each services
  - Export result to local only if `--only-exporters` omitted
  - Don't loading and storing last build number
- Enable debug log
  - `export CI_ANALYZER_DEBUG=1`

# Development
## Recommend to use GitHub Codespaces or VSCode Dev Container extensions
This repository provide devcontainer that includes all dependencies for developing CIAnalyzer. So we recommend to use GitHub Codespaces that will build environment from .devcontainer or VSCode Dev Container extensions that also will build development environment in your machine.

## Install and test
```bash
npm ci
npm run test
```

## Generate pb_types and bigquery_schema from .proto files
Install [Earthly](https://earthly.dev/) first and then execute these commands.

```
npm run proto
```

## Docker build
Install [Earthly](https://earthly.dev/) first and then execute these commands.

```
npm run docker
```

## Execute CIAnalyzer using nodejs
### Debugging

```bash
npx tsx src/index.ts -c your_custom_config.yaml --debug

```

### Execute production bundled build
```bash
npm run build
npm run start -- -c your_custom_config.yaml
```

# LICENSE
MIT
