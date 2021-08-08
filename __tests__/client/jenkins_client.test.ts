import { Logger } from 'tslog'
import { JenkinsClient } from '../../src/client/jenkins_client'

const logger = new Logger({ minLevel: "warn" })

describe('JenkinsClient', () => {
  const baseUrl = 'http://localhost:8080'
  describe('new', () => {
    it('should not throw error when both user and token are undefined', async () => {
      const client = new JenkinsClient(baseUrl, logger)

      expect(client).toBeTruthy()
    })

    it('should not throw error when both user and token are valid', async () => {
      const client = new JenkinsClient(baseUrl, logger, 'user', 'token')

      expect(client).toBeTruthy()
    })

    it('should throw error when only user is undeinfed', async () => {
      expect(() => {
        const client = new JenkinsClient(baseUrl, logger, undefined, 'token')
      }).toThrow()
    })

    it('should throw error when only token is undeinfed', async () => {
      expect(() => {
        const client = new JenkinsClient(baseUrl, logger, 'usre', undefined)
      }).toThrow()
    })
  })

  describe('filterJobRuns', () => {
    const allCompletedRuns = [
      { id: '2', status: 'SUCCESS' },
      { id: '3', status: 'FAILED' },
      { id: '4', status: 'ABORTED' },
      { id: '5', status: 'SUCCESS' },
      { id: '6', status: 'SUCCESS' },
    ] as any

    const hasInprogressRuns = [
      { id: '2', status: 'SUCCESS' },
      { id: '3', status: 'FAILED' },
      { id: '4', status: 'IN_PROGRESS' },
      { id: '5', status: 'IN_PROGRESS' },
      { id: '6', status: 'SUCCESS' },
    ] as any

    let client: JenkinsClient
    beforeEach(() => {
      client = new JenkinsClient(baseUrl, logger)
    })

    it('when lastRunId is undef and has not in_pregress runs', async () => {
      const lastRunId = undefined
      const actual = client.filterJobRuns(allCompletedRuns, lastRunId)

      expect(actual.map((run) => run.id)).toEqual(['2','3','4','5','6'])
    })

    it('when defined lastRunId and has not in_pregress runs', async () => {
      const lastRunId = 2
      const actual = client.filterJobRuns(allCompletedRuns, lastRunId)

      expect(actual.map((run) => run.id)).toEqual(['3','4','5','6'])
    })

    it('when lastRunId is undef and has in_pregress runs', async () => {
      const lastRunId = undefined
      const actual = client.filterJobRuns(hasInprogressRuns, lastRunId)

      expect(actual.map((run) => run.id)).toEqual(['2','3'])
    })

    it('when defined lastRunId and has in_pregress runs', async () => {
      const lastRunId = 2
      const actual = client.filterJobRuns(hasInprogressRuns, lastRunId)

      expect(actual.map((run) => run.id)).toEqual(['3'])
    })
  })
})
