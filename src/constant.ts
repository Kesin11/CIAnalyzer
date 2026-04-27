import path from "node:path";
const __dirname = import.meta.dirname;

// Keep schema paths anchored from src/ so local tsx execution and the container image resolve them the same way.
export const BQ_SCHEMA_PATHS = {
  workflow: path.join(__dirname, "..", "bigquery_schema/workflow_report.json"),
  test_report: path.join(__dirname, "..", "bigquery_schema/test_report.json"),
};
