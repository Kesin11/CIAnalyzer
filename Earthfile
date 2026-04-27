VERSION 0.7

# TypeScript runtime
FROM node:24.15.0
LABEL org.opencontainers.image.source=https://github.com/Kesin11/CIAnalyzer
LABEL org.opencontainers.image.authors=kesin1202000@gmail.com
WORKDIR /build

all:
  BUILD +build
  BUILD +test
  BUILD +docker
  BUILD +schema

deps:
  COPY package.json package-lock.json .
  RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

  ENV TINI_VERSION v0.19.0
  RUN curl -sSL https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini -o /tini
  SAVE ARTIFACT /tini

  SAVE IMAGE --cache-hint

build:
  FROM +deps
  COPY package.json package-lock.json README.md LICENSE ci_analyzer.yaml .
  COPY --dir bin src ./
  COPY ./proto+protoc/pb_types src/pb_types
  COPY ./proto+protoc/schema bigquery_schema/
  RUN npm run build
  SAVE ARTIFACT package.json
  SAVE ARTIFACT package-lock.json
  SAVE ARTIFACT README.md
  SAVE ARTIFACT LICENSE
  SAVE ARTIFACT ci_analyzer.yaml
  SAVE ARTIFACT bin
  SAVE ARTIFACT src
  SAVE ARTIFACT bigquery_schema
  SAVE IMAGE --cache-hint

proto:
  BUILD ./proto+protoc
  COPY ./proto+protoc/pb_types /tmp/pb_types
  COPY ./proto+protoc/schema /tmp/schema
  SAVE ARTIFACT /tmp/pb_types/* AS LOCAL ./src/pb_types/
  SAVE ARTIFACT /tmp/schema/* AS LOCAL ./bigquery_schema/

test:
  FROM +deps
  COPY --dir src tsconfig.json \
      tests vitest.config.ts bigquery_schema ./
  COPY ./proto+protoc/pb_types src/pb_types
  COPY ./proto+protoc/schema bigquery_schema/
  RUN npm run test:ci
  SAVE ARTIFACT junit AS LOCAL ./junit
  SAVE ARTIFACT coverage AS LOCAL ./coverage

docker:
  FROM node:24.15.0-slim
  WORKDIR /ci_analyzer

  COPY +build/package.json +build/package-lock.json ./
  RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
  COPY +build/README.md +build/LICENSE +build/ci_analyzer.yaml ./
  COPY +build/bin ./bin
  COPY +build/src ./src
  COPY +build/bigquery_schema ./bigquery_schema
  COPY --chmod=755 +deps/tini /tini
  ENTRYPOINT [ "/tini", "--", "/ci_analyzer/node_modules/.bin/tsx", "/ci_analyzer/src/index.ts" ]
  WORKDIR /app

  SAVE IMAGE ghcr.io/kesin11/ci_analyzer:latest

docker-push:
  FROM +docker
  ARG --required TAGS

  FOR TAG IN $TAGS
    SAVE IMAGE --push $TAG
  END

schema:
  FROM +deps
  COPY --dir src scripts ./
  RUN npx tsx scripts/create_schema.ts schema.json
  SAVE ARTIFACT schema.json AS LOCAL ./
