# CIAnalyzer
[![CI](https://github.com/Kesin11/CIAnalyzer/workflows/CI/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker build](https://github.com/Kesin11/CIAnalyzer/workflows/Docker%20build/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/kesin/ci_analyzer)](https://hub.docker.com/r/kesin/ci_analyzer)

CIAnalyzer is a tool for collecting build data from CI services. You can create a dashboard to analyze your build from the collected data.

# Motivation
Today, many CI services provide the ability to build applications, docker images, and many other things.
Since some of these builds can take a long time to build, you may want to analyze your build data, average build time, success rate, etc.

Unfortunately, few services provide a dashboard for analyzing build data. As far as I know Azure Pipeline provides a great feature called [Pipeline reports](https://docs.microsoft.com/en-us/azure/devops/pipelines/reports/pipelinereport?view=azure-devops), but it only shows data about builds that have been run in Azure Pipeline.

CIAnalyzer collects build data using each service API, then normalizes the data format and exports it. So you can create a dashboard that allows you to analyze build data across multiple CI services using your favorite BI tools.

# Sample dashboard
It created by DataStudio with BigQuery
![ci_analyzer_dashboard1](https://user-images.githubusercontent.com/1324862/82752752-3d5bcd00-9dfb-11ea-9cb3-a32e81c5f3b9.png)
![ci_analyzer_dashboard2](https://user-images.githubusercontent.com/1324862/82752755-42b91780-9dfb-11ea-91df-c3451e51772a.png)
![cianalyzer_test_report](https://user-images.githubusercontent.com/1324862/89435621-15380500-d780-11ea-8131-5dde21beb3fa.png)

# Architecture
![CIAnalyzer Architecture](https://user-images.githubusercontent.com/1324862/89551373-d7051900-d845-11ea-9176-332c8995141f.png)


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

## Test report
Test report is a data about test. If you output test result as JUnit format XML and store to archive, CIAnalyzer can collect from it.

- Executed date
- Duration time
- Status(Success, Failed, Skipped, etc.)
- Test name
- Number of test
- Failure test num
- Branch

# Supported services
- CI services
  - GitHub Actions
  - CircleCI (also support enterprise version)
  - Jenkins (only Pipeline job)
- Export
  - BigQuery
  - Local file (output JSON or JSON Lines)

# USAGE
```bash
docker run \
  --mount type=bind,src=${PWD},dst=/app/ \
  --mount type=bind,src=${SERVICE_ACCOUNT},dst=/service_account.json \
  -e GITHUB_TOKEN=${GITHUB_TOKEN} \
  -e CIRCLECI_TOKEN=${CIRCLECI_TOKEN} \
  -e JENKINS_USER=${JENKINS_USER} \
  -e JENKINS_TOKEN=${JENKINS_TOKEN} \
  -e GOOGLE_APPLICATION_CREDENTIALS=/service_account.json \
  kesin/ci_analyzer:latest -c ci_analyzer.yaml
```

## Setup ENV
- Services
  - GITHUB_TOKEN: GitHub auth token
  - CIRCLECI_TOKEN: CircleCI API token
  - JENKINS_USER: Username for login to your Jenkins
  - JENKINS_TOKEN: Jenkins user API token
- Exporter
  - GOOGLE_APPLICATION_CREDENTIALS: GCP service account json path
- LastRunStore
  - GOOGLE_APPLICATION_CREDENTIALS

## Setup BigQuery (Recommend)
If you want to use `bigquery_exporter`, you have to create table that CIAnalyzer will export data to it.

```bash
bq mk
  --project_id=${YOUR_GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TABLE} \
  ./bigquery_schema/workflow_report.json

bq mk
  --project_id=${YOUR_GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TABLE} \
  ./bigquery_schema/test_report.json
```

And also GCP service account used for CIAnalyzer needs some BigQuery permissions. Please attach `roles/bigquery.dataEditor` and `roles/bigquery.jobUser`. More detail, check [BigQuery access control document](https://cloud.google.com/bigquery/docs/access-control).

## Setup GCS bucket (Recommend)
### What is LastRunStore
CIAnalyzer collects build data from each CI service API, but there may be duplicates of the previously collected data. To remove the duplicate, it is necessary to save the last build number of the previous run and output only the difference from the previous run.

After CIAnalyzer collects build data successfully, it save each job build number and load before next time execution. This feature called LastRunStore.

By default, CIAnalyzer uses a local JSON file as a backend for LastRunStore. However, the last build number needs to be shared, for example when running CIAnalyzer on Jenkins which uses multiple nodes.

Resolving these problems, CIAnalyzer can use GCS as LastRunStore to read/write the last build number from any machine. It inspired by [Terraform backend](https://www.terraform.io/docs/backends/index.html).

### Create GCS bucket
If you want to use `lastRunStore.backend: gcs`, you have to create GCS bucket before execute CIAnalyzer.

```bash
gsutil mb -l ${LOCATION} gs://${BUCKET_NAME}
```

And also GCP service account needs to read and write permissions for the target bucket. More detail, check [GCS access control document](https://cloud.google.com/storage/docs/access-control/iam-permissions).

## Edit config YAML
Copy [ci_analyzer.yaml](./ci_analyzer.yaml) and edit to your preferred configuration. CIAnalyzer uses `ci_analyzer.yaml` as config file in default, but it can change with `-c` options.

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

# Roadmap
- [ ] Collect test data (maybe support JUnit XML)
- [ ] Output queued waiting duration time
- [ ] Support Bitrise
- [ ] collect any of JSON data from build artifacts

# Development
## Install
```bash
npm ci
npm run build
```

## Execute CIAnalyzer using nodejs
```bash
npm run start
# or
node dist/index.js -c your_custom_config.yaml
```

## For debuging
- Export `CI_ANALYZER_DEBUG=1`

# LICENSE
MIT
