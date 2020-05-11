import { BigqueryExporter } from '../../src/exporter/bigquery_exporter'

describe('BigqueryExporter', () => {
  describe('new', () => {
    it('should not throw when project, dataset, table are not undefined', async () => {
      expect(() => {
        const _exporter = new BigqueryExporter('project', 'dataset', 'table' )
      })
    })

    it('should throw when some of project, dataset, table is undefined', async () => {
      expect(() => {
        const _exporter = new BigqueryExporter(undefined, 'dataset', 'table' )
      }).toThrow()

      expect(() => {
        const _exporter = new BigqueryExporter('project', undefined, 'table' )
      }).toThrow()

      expect(() => {
        const _exporter = new BigqueryExporter('project', 'dataset', undefined )
      }).toThrow()
    })
  })
})
