---
description: "Use when editing CIAnalyzer documentation, config samples, Docker usage examples, or YAML examples. Covers Docker-first usage, config schema references, and sample consistency."
name: "CIAnalyzer Docs and Config Guidelines"
applyTo: README.md, ci_analyzer.yaml, sample/**
---
# CIAnalyzer Docs and Config Guidelines

- Prefer documenting CIAnalyzer as a Docker-first tool. Keep `docker run` examples, mounted paths, and container path references consistent with the current container workflow.
- When updating config examples, keep the YAML schema magic comment intact unless the schema location itself changes:
  `# yaml-language-server: $schema=https://raw.githubusercontent.com/Kesin11/CIAnalyzer/master/schema.json`
- Keep `README.md`, `ci_analyzer.yaml`, and files under `sample/` aligned when changing documented config keys, environment variables, exporter examples, or LastRunStore behavior.
- Preserve container-specific caveats in docs, especially where config paths are resolved inside the container and where extra bind mounts are required for custom schema JSON.
- When documenting local development or runtime requirements, align Node.js references with `mise.toml` and formatting/linting references with the Biome scripts in `package.json`.
- If a feature is primarily intended for container usage, prefer examples that work as-is with the published container image before adding local-only workflows.
