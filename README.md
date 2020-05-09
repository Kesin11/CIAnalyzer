# CIAnalyzer
[![CI](https://github.com/Kesin11/CIAnalyzer/workflows/CI/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker build](https://github.com/Kesin11/CIAnalyzer/workflows/Docker%20build/badge.svg)](https://github.com/Kesin11/CIAnalyzer/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/kesin/ci_analyzer)](https://hub.docker.com/r/kesin/ci_analyzer)

Export multi CI service build data for analyzing.

# Install
```bash
npm ci
npm run build
```

# USAGE
## Setup ENV first
### auth

- services
  - GITHUB_TOKEN
  - CIRCLECI_TOKEN
  - JENKINS_USER
  - JENKINS_TOKEN
- exporter
  - GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp/service_account.json

### debug
- CI_ANALYZER_DEBUG=1

## Setup BigQuery (Optional)
If you want `bigquery_exporter`, you need to setup BigQuery before execute.

You have to create dataset and table.  
example:

```bash
bq mk
  --project_id=${YOUR_GCP_PROJECT_ID} \
  --table \
  --time_partitioning_field=createdAt \
  ${DATASET}.${TABLE} \
  ./bigquery_schema/workflow_report.json
```


## Edit config yaml
Edit config yaml [ci_analyzer.yaml](./ci_analyzer.yaml) or copy to another one and editing it.

## Execute using nodejs
```bash
npm run start

npx ci_analyzer

node dist/index.js -c your_custom_config.yaml
```

## Execute using docker (recommend)
```bash
docker pull kesin/ci_analyzer:lates

docker run \
  --mount type=bind,src=${PWD}/ci_analyzer.yaml,dst=/app/ci_analyzer.yaml \
  --mount type=bind,src=${PWD}/output,dst=/app/output \
  --mount type=bind,src=${PWD}/.ci_analyzer,dst=/app/.ci_analyzer \
  --mount type=bind,src=/path/to/gcp/service_account.json,dst=/app/service_account.json
  -e GITHUB_TOKEN=${GITHUB_TOKEN} \
  -e CIRCLECI_TOKEN=${CIRCLECI_TOKEN} \
  -e JENKINS_USER=${JENKINS_USER} \
  -e JENKINS_TOKEN=${JENKINS_TOKEN} \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service_account.json \
  ci_analyzer:latest
```

See sample [cron jenkins job script](./cron.jenkinsfile)

### mount
- ci_analyzer.yaml: Your config file.
- output/: `local_exporter` output default directory. you can change it by config.
- .ci_analyzer/: CIAnalyzer internal using directory for multi purpose.
  - Store last run number.

### network
If your jenkins is working on docker host machine, you should not use "localhost" to jenkins.baseUrl config. Docker can not access your Jenkins server by "localhost".

For resolve this issue, you should use host machine IP address. For example, "http://192.168.0.1:8080".

# LICENSE
MIT
