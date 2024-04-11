VERSION 0.7

# TypeScript build
FROM node:20.12.2
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
  RUN --mount=type=cache,target=/root/.npm npm ci

  ENV TINI_VERSION v0.19.0
  RUN curl -sSL https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini -o /tini
  SAVE ARTIFACT /tini

  SAVE IMAGE --cache-hint

build:
  FROM +deps
  COPY --dir src scripts tsconfig.json .
  COPY ./proto+protoc/pb_types src/pb_types
  RUN npm run build:clean
  SAVE ARTIFACT dist AS LOCAL ./dist
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
      __tests__ vitest.config.ts bigquery_schema ./
  COPY ./proto+protoc/pb_types src/pb_types
  COPY ./proto+protoc/schema bigquery_schema/
  RUN npm run test:ci
  SAVE ARTIFACT junit AS LOCAL ./junit
  SAVE ARTIFACT coverage AS LOCAL ./coverage

docker:
  FROM node:20-slim
  WORKDIR /ci_analyzer

  COPY package.json package-lock.json .
  COPY README.md LICENSE ci_analyzer.yaml .
  COPY ./proto+protoc/schema bigquery_schema/
  COPY +build/dist ./dist
  COPY --chmod=755 +deps/tini /tini

  # Make "ci_analyzer" command alias
  RUN cd dist && ln -s index.mjs ci_analyzer && chmod +x ci_analyzer
  ENV PATH=/ci_analyzer/dist:$PATH

  ENTRYPOINT [ "/tini", "--", "node", "--enable-source-maps", "/ci_analyzer/dist/index.mjs" ]
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
