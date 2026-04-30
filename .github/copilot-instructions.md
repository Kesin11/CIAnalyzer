# CIAnalyzer AI Coding Agent Instructions

## Project Overview
**CIAnalyzer** is a CLI tool that collects build data from multiple CI services (GitHub Actions, CircleCI, Jenkins, Bitrise) and exports normalized workflow/test reports to data warehouses (BigQuery, GCS, local files). Built with TypeScript, it follows a plugin-based architecture with separate analyzers, clients, and exporters for each service.

## Architecture Patterns

### Core Flow: Runner → Analyzer → Exporter
- **Runners** (`src/runner/`): Service-specific orchestrators that coordinate data collection
- **Clients** (`src/client/`): HTTP API clients for each CI service with retry/throttling
- **Analyzers** (`src/analyzer/`): Transform service-specific data to common `WorkflowReport`/`TestReport` schemas
- **Exporters** (`src/exporter/`): Output data to BigQuery, GCS, or local files

### Service Plugin Pattern
Each CI service has consistent components:
```
src/{client,runner,analyzer,config}/*_service.ts
```
When adding services, follow this pattern with identical interfaces.

### Configuration System
- **YAML schema validation**: Uses Zod with strict validation in `src/config/`
- **Magic comment**: `# yaml-language-server: $schema=https://raw.githubusercontent.com/Kesin11/CIAnalyzer/master/schema.json`
- **Config schema**: `schema.json` is maintained as a static source file

## Data Model
**Critical**: Report TypeScript types and BigQuery schemas are maintained as
static source files. Do not regenerate them from proto/protoc.

Key schemas:
- `bigquery_schema/workflow_report.json`: Build/job execution data
- `bigquery_schema/test_report.json`: JUnit test results

## Development Workflows

### Build System
- **Local development**: `npm run check` and `npm test`
- **CI builds**: GitHub Actions run type checks, tests, and Docker Buildx builds

### Testing with Vitest
- **Run tests**: `npm test` (uses UTC timezone)
- **Coverage**: `npm run test:ci`
- **JUnit output**: Saved to `junit/junit.xml` for CI analysis

### Code Quality (Biome)
- **Format + Lint**: `npm run fmt:fix && npm run lint:fix`
- **Before pushing changes**: always run `npm run fmt:fix && npm run lint:fix`
- **CI check**: `npm run biome:ci`
- **TypeScript check**: `npm run check` (or `npm run check:watch` for watch mode)
- No Prettier/ESLint - uses Biome exclusively

## Key Configuration Concepts

### Last Run Store
Prevents duplicate data collection by tracking last processed build numbers:
- **Local**: JSON files (default)
- **GCS**: Shared across environments (recommended for production)

### Custom Reports
Collect arbitrary JSON from CI artifacts:
1. Define BigQuery schema in `bigquery_schema/`
2. Configure `customReports[]` in YAML
3. Schema path resolution works from config file location

### Environment Variables
Required tokens per service:
- `GITHUB_TOKEN`, `CIRCLECI_TOKEN`, `JENKINS_USER`/`JENKINS_TOKEN`, `BITRISE_TOKEN`
- `GOOGLE_APPLICATION_CREDENTIALS` for BigQuery/GCS

## Error Handling Patterns
- **Result types**: Use `src/result.ts` for explicit error handling
- **HTTP errors**: `HttpError` from `src/client/http_client.ts` automatically retries and gets formatted in `CompositRunner`
- **API errors**: GCP errors are caught and formatted with detailed context

## Docker Usage
- **Main image**: `ghcr.io/kesin11/ci_analyzer:v5`
- **Volume mounts**: Config file and service account JSON
- **Debug mode**: `--debug` limits to 10 builds and forces local export

## Testing Patterns
- **Fixtures**: Use `tests/fixture/` for sample CI API responses
- **Mock patterns**: Vitest with `clearMocks: true` in config 
- **Date handling**: Always use UTC timezone in tests

## Development Tips
- **Debug commands**: `npx tsx src/index.ts -c config.yaml --debug`
- **Service isolation**: `--only-services github` for focused development
- **Local export only**: `--only-exporters local` for testing
- **Concurrency**: `--max-concurrent-requests N` for API rate limiting
- **Force save last run**: `--force-save-last-run` to persist state even if error occurred (useful for partial success scenarios)

## File Structure Conventions
- **Strict separation**: Each service has dedicated files in all layers
- **Config validation**: Use Zod schemas in `src/config/` with `.strict()` 
- **Type exports**: Export only `ValidatedYamlConfig`, never raw types
- **Report schemas**: Keep TypeScript report schemas/types and BigQuery schema JSON in sync manually
