# CIAnalyzer
[![CI](https://github.com/Kesin11/CIAnalyzer/workflows/CI/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker build](https://github.com/Kesin11/CIAnalyzer/workflows/Docker%20build/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/kesin/ci_analyzer)](https://hub.docker.com/r/kesin/ci_analyzer)

CIAnalyzer is a tool collecting multi CI services build data and export it for creating self-hosting build dashboard.

# Motivation
Today, many CI services provide a feature to build various things, such as applications or docker images, etc.
Because some use cases take longer to build, we sometimes want to know the average build time, success rate, which steps are consuming the most time, etc.

Unfortunately, few services provide a dashboard for analyzing build data. As far as I know Azure Pipeline provides a great feature called [Pipeline reports](https://docs.microsoft.com/en-us/azure/devops/pipelines/reports/pipelinereport?view=azure-devops), but it only shows data about builds that have been run in Azure Pipeline. It does not support other CI services such as Jenkins or CircleCI.

CIAnalyzer collects build data using each service API, normalizes the data format, and exports it. So you can create a dashboard that allows you to analyze build data across multiple CI services using your favorite BI tools.

(Sample dashboard created by DataStudio with BigQuery)
![ci_analyzer_dashboard1](https://user-images.githubusercontent.com/1324862/82752752-3d5bcd00-9dfb-11ea-9cb3-a32e81c5f3b9.png)
![ci_analyzer_dashboard2](https://user-images.githubusercontent.com/1324862/82752755-42b91780-9dfb-11ea-91df-c3451e51772a.png)

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

## Setup BigQuery (Optional)
If you want to use `bigquery_exporter`, you have to create table that CIAnalyzer will export data to it.

```bash
bq mk
  --project_id=${YOUR_GCP_PROJECT_ID} \
  --location=${LOCATION} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TABLE} \
  ./bigquery_schema/workflow_report.json
```

And service account need some BigQuery permissions. Please attach `roles/bigquery.dataEditor` and `roles/bigquery.jobUser`. More detail, check [BigQuery access control document](https://cloud.google.com/bigquery/docs/access-control).

## Setup GCS bucket (Optional)
It you want to use `lastRunStore.backend: gcs`, you have to create GCS bucket that CIAnalyzer will store files to it.

```bash
gsutil mb -l ${LOCATION} gs://${BUCKET_NAME}
```

And service account need to read and write permissions for target bucket. More detail, check [GCS access control document](https://cloud.google.com/storage/docs/access-control/iam-permissions).

## Edit config yaml
Copy [ci_analyzer.yaml](./ci_analyzer.yaml) and edit to your prefere configuration. CIAnalyzer use `ci_analyzer.yaml` as config file in default, but it can change with `-c` options.

More detail for config file, please check [ci_analyzer.yaml](./ci_analyzer.yaml) and [sample files](./sample).

## Execute on CI service with cron (Recommend)
CIAnalyzer is designed as a tool that runs every time, not as an agent. It's a  good idea to run it with cron on CI services such as CircleCI or Jenkins.

Please check [sample](./sample/README.md), then copy it and edit to your configuration.

# Architecture
![CIAnalyzer Architecture](https://user-images.githubusercontent.com/1324862/82753868-34232e00-9e04-11ea-84b4-1c88821dbdaa.png)

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
