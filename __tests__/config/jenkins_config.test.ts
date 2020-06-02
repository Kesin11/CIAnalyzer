import { parseConfig } from '../../src/config/jenkins_config'

describe('parseConfig', () => {
  it('when repos are string', () => {
    const config = {
      configDir: __dirname,
      jenkins: {
        baseUrl: 'http://localhost:8080',
        jobs: [ 'sample-job' ]
      }
    }

    const actual = parseConfig(config)
    expect(actual).toEqual(config.jenkins)
  })

  it('when repos are object', () => {
    const config = {
      configDir: __dirname,
      jenkins: {
        baseUrl: 'http://localhost:8080',
        jobs: [{
          name: 'sample-job',
          tests: ['**/*.xml']
        }]
      }
    }

    const actual = parseConfig(config)
    expect(actual).toEqual({
      baseUrl: 'http://localhost:8080',
      jobs: [{
        name: 'sample-job', testGlob: ['**/*.xml']
      }]
    })
  })
})
