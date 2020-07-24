import { BigqueryExporter } from '../../src/exporter/bigquery_exporter'

const bigqueryMock = {
  dataset: jest.fn().mockReturnThis(),
  table: jest.fn().mockReturnThis(),
  load: jest.fn(async () => [{}]) // return success 'results' stub
}

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

  describe('exportWorkflowReports', () => {
    const report = [{}]
    let exporter: BigqueryExporter
    beforeEach(() => {
      exporter = new BigqueryExporter('project', 'dataset', 'table' )
      exporter.bigquery = bigqueryMock as any
    })

    it('should finish with no error', async () => {
      await exporter.exportWorkflowReports(report as any)

      expect(bigqueryMock.load.mock.calls.length).toBe(1)
    })
  })
})
