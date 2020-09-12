import { parseConfig } from '../../src/config/github_config'

describe('parseConfig', () => {
  it('when repos are string', () => {
    const config = {
      configDir: __dirname,
      github: {
        repos: [
          'owner/repo'
        ]
      }
    }
    const actual = parseConfig(config)

    expect(actual).toEqual({
      repos: [
        { owner: 'owner', repo: 'repo', fullname: 'owner/repo', testGlob: [] }
      ]
    })
  })

  describe('when repos are object', () => {
    it('that has tests', () => {
      const config = {
        configDir: __dirname,
        github: {
          repos: [{
            name: 'owner/repo',
            tests: [ '**/*.xml' ]
          }]
        }
      }
      const actual = parseConfig(config)

      expect(actual).toEqual({
        repos: [
          { owner: 'owner', repo: 'repo', fullname: 'owner/repo', testGlob: ['**/*.xml'] }
        ]
      })
    })

    it('that has custom_reports', () => {
      const customReport = { name: 'custom', paths: ['custom.json'] }
      const config = {
        configDir: __dirname,
        github: {
          repos: [{
            name: 'owner/repo',
            custom_reports: [ customReport ]
          }]
        }
      }
      const actual = parseConfig(config)

      expect(actual).toEqual({
        repos: [{
          owner: 'owner', repo: 'repo', fullname: 'owner/repo',
          customReports: [ customReport ]
        }]
      })
    })
  })
})