import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export type YamlConfig = {
  'github'?: { [key: string]: any }
  'circleci'?: { [key: string]: any }
  'jenkins'?: { [key: string]: any }
}

export type CommonConfig = {
  exporter?: ExporterConfig
  lastRunStore?: string
}

export type ExporterConfig = {
  [exporterName: string]: {
    [options: string]: any
  }
}

const defaultPath = path.join(__dirname, '../../ci_analyzer.yaml')

export const loadConfig = (configPath?: string): YamlConfig => {
  configPath = configPath ?? defaultPath

  const config = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'))
  // TODO: Add File open error handling

  return config as YamlConfig
}