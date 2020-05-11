import { LocalExporter } from '../../src/exporter/local_exporter'
import path from 'path'

describe('LocalExporter', () => {
  describe('new', () => {
    it('should all set with default parameter when options is null', async () => {
      // Argument type does not accept null, but some case js-yaml returns 'null' as exporter options
      const exporter = new LocalExporter('github', null as any )

      expect(exporter.outDir).toEqual(path.resolve('output'))
      expect(exporter.formatter).toEqual(exporter.formatJson)

    })
  })
})
