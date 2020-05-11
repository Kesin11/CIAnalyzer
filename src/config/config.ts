import fs from 'fs'
import yaml from 'js-yaml'

export type YamlConfig = {
  'github'?: { [key: string]: any }
  'circleci'?: { [key: string]: any }
  'jenkins'?: { [key: string]: any }
}

export type CommonConfig = {
  exporter?: ExporterConfig
  lastRunStore?: string
  vscBaseUrl?: {
    github?: string
  }
}

export type ExporterConfig = {
  [exporterName: string]: {
    [options: string]: any
  }
}

const defaultPath = './ci_analyzer.yaml'

export const loadConfig = (configPath?: string): YamlConfig => {
  configPath = configPath ?? defaultPath

  const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))

  if (process.env['CI_ANALYZER_DEBUG']) {
    console.debug('Parsed config file:')
    console.debug(JSON.stringify(config, null, 2))
  }

  return config as YamlConfig
}