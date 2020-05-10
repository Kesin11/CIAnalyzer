import { parseConfig } from '../../src/config/jenkins_config'

describe('parseConfig', () => {
  describe('repos', () => {
    it('should have valid job names', () => {
      const config = {
        jenkins: {
          baseUrl: 'http://localhost:8080',
          jobs: [ 'sample-job' ]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual(config.jenkins)
    })
  })
})
