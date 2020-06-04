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

  it('when repos are object', () => {
    const config = {
      configDir: __dirname,
      github: {
        repos: [{
          name: 'owner/repo',
          tests: [
            '**/*.xml'
          ]
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
})