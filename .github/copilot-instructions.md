# CIAnalyzer AI Coding Agent Instructions

## Project Overview

**CIAnalyzer** is a CLI tool that collects build data from multiple CI services (GitHub Actions, CircleCI, Jenkins, Bitrise) and exports normalized workflow/test reports to data warehouses (BigQuery, GCS, local files). Built with TypeScript, it follows a plugin-based architecture with separate analyzers, clients, and exporters for each service.

## Repository Conventions

- CIAnalyzer is a Node ESM TypeScript CLI. The executable entrypoint is `src/index.ts`, and `package.json` points the `ci_analyzer` bin directly to that file.
- CIAnalyzer is primarily intended to be used as a containerized tool. Prefer preserving and documenting the Docker-first workflow in `README.md`, sample configs, and container-related changes.
- Keep `Dockerfile` aligned with the runtime entrypoint and container UX. The image currently runs `src/index.ts` directly and copies runtime assets such as `src/`, `bigquery_schema/`, `README.md`, `LICENSE`, and `ci_analyzer.yaml`.
- Node.js version management is defined in `mise.toml`. Keep runtime-related changes consistent with the pinned Node version there and with the base image used in `Dockerfile`.
- Formatting and linting are handled with Biome (`biome.jsonc`, `npm run fmt:fix`, `npm run lint:fix`). Prefer Biome-compatible changes and do not introduce overlapping formatter/linter tooling without a strong reason.
- Keep internal TypeScript imports explicit with `.ts` extensions, and use `node:`-prefixed imports for Node built-ins.
- Preserve the plugin-oriented structure. Service-specific behavior should usually be implemented in the matching `analyzer/`, `client/`, `runner/`, `config/`, `exporter/`, or `store/` area instead of adding cross-cutting special cases.
- Configuration validation is defined with Zod under `src/config/`, and `schema.json` is the auto-generated JSON Schema for the `ci_analyzer.yaml` config file. Regenerate it with `npm run json_schema`. When adding or changing config options, update the relevant Zod schema, regenerated `schema.json`, tests, and user-facing samples or docs together.
- BigQuery report schemas are maintained separately under `bigquery_schema/`. When changing workflow, test, or custom report shapes or exported fields, update the corresponding static BigQuery schema files in the same change.
- Prefer validating code changes with `npm run check` and `npm test`. Run `npm run fmt:fix` and `npm run lint:fix` when formatting or lint cleanup is needed. When changing runtime packaging or container behavior, also run `npm run docker`.
