import { LocalExporter } from '../../src/exporter/local_exporter'
import path from 'path'
import { LocalExporterConfig } from '../../src/config/config'

const mockFsPromises = {
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}

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
  describe('export', () => {
    const report = [{}]
    const config: LocalExporterConfig = { outDir: 'testTmp' }
    const configDir = __dirname
    let exporter: LocalExporter
    beforeEach(() => {
      exporter = new LocalExporter('github', configDir, config)
      exporter.fsPromises = mockFsPromises as any
    })

    it('exportWorkflowReports create {DATE}-workflow-{SERVICE}.json', async () => {
      await exporter.exportWorkflowReports(report as any)

      expect(mockFsPromises.writeFile).toHaveBeenCalled()
      expect(mockFsPromises.writeFile.mock.calls[0][0]).toMatch(/.+-workflow-github.json/)
    })

    it('exporTestReports create {DATE}-test-{SERVICE}.json', async () => {
      await exporter.exportTestReports(report as any)

      expect(mockFsPromises.writeFile).toHaveBeenCalled()
      expect(mockFsPromises.writeFile.mock.calls[0][0]).toMatch(/.+-test-github.json/)
    })
  })
})
