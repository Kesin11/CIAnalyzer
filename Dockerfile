# syntax=docker/dockerfile:1

FROM node:24.16.0-slim

LABEL org.opencontainers.image.source=https://github.com/Kesin11/CIAnalyzer
LABEL org.opencontainers.image.authors=kesin1202000@gmail.com

WORKDIR /ci_analyzer

RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

COPY README.md LICENSE ci_analyzer.yaml ./
COPY src ./src
COPY bigquery_schema ./bigquery_schema

RUN ln -s /ci_analyzer/src/index.ts /usr/local/bin/ci_analyzer

ENTRYPOINT ["/usr/bin/tini", "--", "/ci_analyzer/src/index.ts"]
WORKDIR /app
