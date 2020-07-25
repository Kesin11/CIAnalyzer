import { BigqueryExporter } from '../../src/exporter/bigquery_exporter'
import { BigqueryExporterConfig } from '../../src/config/config'

const bigqueryMock = {
  dataset: jest.fn().mockReturnThis(),
  table: jest.fn().mockReturnThis(),
  load: jest.fn(async () => [{}]) // return success 'results' stub
}

describe('BigqueryExporter', () => {
  const config: BigqueryExporterConfig = {
    project: 'project',
    dataset: 'dataset',
    reports: [
      { name: 'workflow', table: 'workflow' },
      { name: 'test_report', table: 'test_report' },
    ]
  }
  describe('new', () => {
    it('should not throw when any params are not undefined', async () => {
      expect(() => {
        new BigqueryExporter(config)
      })
    })

    it('should throw when project is undefined', async () => {
      const _config = { ...config, project: undefined }
      expect(() => {
        new BigqueryExporter(_config)
      }).toThrow()
    })

    it('should throw when dataset is undefined', async () => {
      const _config = { ...config, dataset: undefined }
      expect(() => {
        new BigqueryExporter(_config)
      }).toThrow()
    })

    it('should throw when workflow table is undefined', async () => {
      const _config = { ...config, reports: [{ name: 'workflow', table: 'workflow'}] }
      expect(() => {
        new BigqueryExporter(_config as any)
      }).toThrow()
    })

    it('should throw when test_report table is undefined', async () => {
      const _config = { ...config, reports: [{ name: 'test_report', table: 'test_report'}] }
      expect(() => {
        new BigqueryExporter(_config as any)
      }).toThrow()
    })
  })

  describe('exportWorkflowReports', () => {
    const report = [{}]
    let exporter: BigqueryExporter
    beforeEach(() => {
      exporter = new BigqueryExporter(config)
      exporter.bigquery = bigqueryMock as any
    })

    it('should finish with no error', async () => {
      await exporter.exportWorkflowReports(report as any)

      expect(bigqueryMock.load.mock.calls.length).toBe(1)
    })
  })
})
