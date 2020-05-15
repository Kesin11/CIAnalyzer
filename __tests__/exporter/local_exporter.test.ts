import { LocalExporter } from '../../src/exporter/local_exporter'
import path from 'path'

describe('LocalExporter', () => {
  describe('new', () => {
    it('should all property set with default parameter when options is null', async () => {
      const configDir = __dirname
      // Argument type does not accept null, but some case js-yaml returns 'null' as exporter options
      const exporter = new LocalExporter('github', configDir, null as any )

      expect(exporter.outDir).toEqual(path.resolve(configDir, 'output'))
      expect(exporter.formatter).toEqual(exporter.formatJson)
    })
  })
})
