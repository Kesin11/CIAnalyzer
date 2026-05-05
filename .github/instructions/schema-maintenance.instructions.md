---
description: "Use when editing the CIAnalyzer config schema, BigQuery schema files, or report shape definitions. Covers keeping the ci_analyzer.yaml schema, BigQuery schemas, source schemas, and docs in sync."
name: "CIAnalyzer Schema Maintenance"
applyTo: schema.json, bigquery_schema/**, src/config/**/*.ts
---
# CIAnalyzer Schema Maintenance

- Treat `schema.json` and files under `bigquery_schema/` as maintained source artifacts, not generated output.
- `schema.json` is the JSON Schema for the `ci_analyzer.yaml` config file, and it is separate from the BigQuery schemas under `bigquery_schema/`.
- When changing config options in `src/config/`, update the matching Zod schemas and keep `schema.json`, `ci_analyzer.yaml`, relevant samples, and README documentation in sync.
- When changing workflow, test, or custom report shapes, update the corresponding static BigQuery schema JSON files in `bigquery_schema/` in the same change.
- Preserve compatibility between documented YAML examples and the current JSON schema so editor validation via the YAML schema comment continues to work.
- If a schema change affects container usage, also update any related mount-path or file-path documentation in `README.md` and `sample/`.
