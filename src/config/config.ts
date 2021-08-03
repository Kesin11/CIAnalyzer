import fs from 'fs'
import yaml from 'js-yaml'
import { Logger } from 'tslog'

export type YamlConfig = {
  github?: { [key: string]: unknown }
  circleci?: { [key: string]: unknown }
  jenkins?: { [key: string]: unknown }
  bitrise?: { [key: string]: unknown }
}

export type CommonConfig = {
  baseUrl?: string
  exporter?: ExporterConfig
  lastRunStore?: LastRunStoreConfig
}

export type ExporterConfig = {
  local: LocalExporterConfig | null
  bigquery: BigqueryExporterConfig | null
}

export type LocalExporterConfig = {
  outDir?: string
  format?: 'json' | 'json_lines'
}

export type BigqueryExporterConfig = {
  project?: string
  dataset?: string
  reports?: {
    name: 'workflow' | 'test_report'
    table: string
  }[]
  customReports?: {
    name: string
    table: string
    schema: string
  }[]
  maxBadRecords?: number
}

export type LastRunStoreConfig = {
  backend: 'local'
  path: string
} | {
  backend: 'gcs'
  project: string
  bucket: string
  path?: string
}

export type CustomReportConfig = {
  name: string
  paths: string[]
}

export const loadConfig = (logger: Logger, configPath: string): YamlConfig => {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'))
  if (!config || typeof config !== "object") throw `Failed to load ${configPath} or config is not object`

  logger.debug('Parsed config file:')
  logger.debug(JSON.stringify(config, null, 2))

  return config as YamlConfig
}