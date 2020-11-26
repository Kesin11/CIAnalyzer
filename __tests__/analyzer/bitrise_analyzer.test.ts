import fs from 'fs'
import path from 'path'
import { BitriseAnalyzer } from '../../src/analyzer/bitrise_analyzer'
import { BuildLogResponse } from '../../src/client/bitrise_client'

describe('BitriseAnalyzer', () => {
  describe('parseBuildLog', () => {
    it('has error step', async () => {
      const analyzer = new BitriseAnalyzer()
      const fixturePath = path.join(__dirname, '..', 'fixture', 'bitrise_build_log', 'failed.json')
      const buildLogResponse = JSON.parse(await fs.promises.readFile(fixturePath, { encoding: 'utf8' })) as BuildLogResponse

      const expected = [
        { name: "activate-ssh-key", duration: "7.28 sec" },
        { name: "git-clone@4", duration: "8.22 sec" },
        { name: "flutter-installer", duration: "1.5 min" },
        { name: "flutter-analyze", duration: "45.71 sec" },
        { name: "flutter-test", duration: "32.41 sec" },
        { name: "flutter-build (exit code: 1)", duration: "4.1 min" },
        { name: "deploy-to-bitrise-io", duration: "30.23 sec" },
      ]

      const actual = analyzer.parseBuildLog(buildLogResponse)
      expect(actual).toEqual(expected)
    })
  })
})
