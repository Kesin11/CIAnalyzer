import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export type YamlConfig = {
  configDir: string
  github?: { [key: string]: any }
  circleci?: { [key: string]: any }
  jenkins?: { [key: string]: any }
}

export type CommonConfig = {
  baseUrl?: string
  exporter?: ExporterConfig
  lastRunStore?: LastRunStoreConfig
  vscBaseUrl?: {
    github?: string
  }
}

export type ExporterConfig = {
  local: LocalExporterConfig
  bigquery: BigqueryExporterConfig
}

export type LocalExporterConfig = {
  outDir: string
  format: 'json' | 'json_lines'
}

export type BigqueryExporterConfig = {
  project?: string
  dataset?: string
  reports?: {
    name: 'workflow' | 'test_report'
    table: string
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

const defaultPath = './ci_analyzer.yaml'

export const loadConfig = (configPath?: string): YamlConfig => {
  configPath = configPath ?? defaultPath

  const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))
  config.configDir = path.dirname(path.resolve(configPath))

  if (process.env['CI_ANALYZER_DEBUG']) {
    console.debug('Parsed config file:')
    console.debug(JSON.stringify(config, null, 2))
  }

  return config as YamlConfig
}