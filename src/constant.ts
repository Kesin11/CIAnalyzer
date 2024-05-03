import path from "node:path";
const __dirname = import.meta.dirname;

// NOTE: Relative path using __dirname is different between esbuild and ts-node
// Therefore, define the paths to the files in constant.ts placed in the same directory as index.ts.
export const BQ_SCHEMA_PATHS = {
  workflow: path.join(__dirname, "..", "bigquery_schema/workflow_report.json"),
  test_report: path.join(__dirname, "..", "bigquery_schema/test_report.json"),
};
