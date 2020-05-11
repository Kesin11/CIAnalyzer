import { JenkinsClient } from '../../src/client/jenkins_client'

describe('JenkinsClient', () => {
  describe('new', () => {
    const baseUrl = 'http://localhost:8080'
    it('should not throw error when both user and token are undefined', async () => {
      const client = new JenkinsClient(baseUrl)

      expect(client).toBeTruthy()
    })

    it('should not throw error when both user and token are valid', async () => {
      const client = new JenkinsClient(baseUrl, 'user', 'token')

      expect(client).toBeTruthy()
    })

    it('should throw error when only user is undeinfed', async () => {
      expect(() => {
        const client = new JenkinsClient(baseUrl, undefined, 'token')
      }).toThrow()
    })

    it('should throw error when only token is undeinfed', async () => {
      expect(() => {
        const client = new JenkinsClient(baseUrl, 'usre', undefined)
      }).toThrow()
    })
  })
})
