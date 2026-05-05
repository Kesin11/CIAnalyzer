---
description: "Use when editing TypeScript source or tests in CIAnalyzer. Covers Node ESM imports, plugin-layer structure, and validation commands."
name: "CIAnalyzer TypeScript Runtime Guidelines"
applyTo: src/**/*.ts, tests/**/*.ts
---
# CIAnalyzer TypeScript Guidelines

- Use Node ESM style imports for internal modules and keep explicit `.ts` extensions in relative import specifiers.
- Prefer `node:` imports for Node built-in modules such as `node:fs` and `node:path`.
- Keep changes aligned with the existing plugin layers: `analyzer/`, `client/`, `runner/`, `config/`, `exporter/`, and `store/`. New CI-service behavior should usually be added in the corresponding layer plus tests.
- Validate TypeScript changes with `npm run check` and `npm test`.
- Run `npm run fmt:fix` or `npm run lint:fix` when your change needs formatting or lint cleanup, and keep changes compatible with the Biome configuration in `biome.jsonc`.
- Also run `npm run docker` when the change affects the CLI runtime entrypoint, Docker image, or container behavior.
