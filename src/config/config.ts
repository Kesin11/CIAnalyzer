import fs from 'fs'
import yaml from 'js-yaml'
import { Logger } from 'tslog'
import { z } from 'zod'

const yamlSchema = z.object({
  github: z.record(z.unknown()).optional(),
  circleci: z.record(z.unknown()).optional(),
  jenkins: z.record(z.unknown()).optional(),
  bitrise: z.record(z.unknown()).optional(),
})
export type YamlConfig = z.infer<typeof yamlSchema>

const localExporterSchema = z.object({
  outDir: z.string().optional(),
  format: z.union([z.literal('json'), z.literal('json_lines')]).optional()
})
export type LocalExporterConfig = z.infer<typeof localExporterSchema>

const bigqueryExporterSchema = z.object({
  project: z.string().optional(),
  dataset: z.string().optional(),
  reports: z.object({
    name: z.union([z.literal('workflow'), z.literal('test_report')]),
    table: z.string(),
  }).array().optional(),
  customReports: z.object({
    name: z.string(),
    table: z.string(),
    schema: z.string(),
  }).array().optional(),
  maxBadRecords: z.number().optional()
})
export type BigqueryExporterConfig = z.infer<typeof bigqueryExporterSchema>

const exporterSchema = z.object({
  local: localExporterSchema.optional(),
  bigquery: bigqueryExporterSchema.optional()
})
export type ExporterConfig = z.infer<typeof exporterSchema>

const lastRunStoreSchema = z.union([
  z.object({
    backend: z.literal('local'),
    path: z.string()
  }),
  z.object({
    backend: z.literal('gcs'),
    project: z.string(),
    bucket: z.string(),
    path: z.string().optional()
  })
])
export type LastRunStoreConfig = z.infer<typeof lastRunStoreSchema>

const customReportSchema = z.object({
  name: z.string(),
  paths: z.string().array()
})
export type CustomReportConfig = z.infer<typeof customReportSchema>

const commonConfig= z.object({
  baseUrl: z.string().optional(),
  exporter: exporterSchema.optional(),
  lastRunStore: lastRunStoreSchema.optional()
})
export type CommonConfig = z.infer<typeof commonConfig>

export const loadConfig = (logger: Logger, configPath: string): YamlConfig => {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'))
  if (!config || typeof config !== "object") throw new Error(`Failed to load ${configPath} or config is not object`)

  logger.debug('Parsed config file:')
  logger.debug(JSON.stringify(config, null, 2))

  return config as YamlConfig
}