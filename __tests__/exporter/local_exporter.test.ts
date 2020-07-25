import { LocalExporter } from '../../src/exporter/local_exporter'
import path from 'path'
import { LocalExporterConfig } from '../../src/config/config'

describe('LocalExporter', () => {
  describe('new', () => {
    it('should all property set with default parameter when options is null', async () => {
      const config: LocalExporterConfig = {}
      const configDir = __dirname
      const exporter = new LocalExporter('github', configDir, config )

      expect(exporter.outDir).toEqual(path.resolve(configDir, 'output'))
      expect(exporter.formatter).toEqual(exporter.formatJson)
    })

    it('should outDir is set when it given by config', async () => {
      const expectedDir = 'test_output'
      const config: LocalExporterConfig = {
        outDir: expectedDir
      }
      const configDir = __dirname
      const exporter = new LocalExporter('github', configDir, config )

      expect(exporter.outDir).toEqual(path.resolve(configDir, expectedDir))
    })

    it('should formatter is set when it given by config', async () => {
      const config: LocalExporterConfig = {
        format: 'json_lines'
      }
      const configDir = __dirname
      const exporter = new LocalExporter('github', configDir, config )

      expect(exporter.formatter).toEqual(exporter.formatJsonLines)
    })
  })
})
