import { parseConfig } from '../../src/config/github_config'

describe('parseConfig', () => {
  const config = {
    github: {
      repos: [
        'owner/repo'
      ]
    }
  }

  it('should have valid owner and repo pair', () => {
    const actual = parseConfig(config)

    expect(actual).toEqual({
      repos: [
        { owner: 'owner', repo: 'repo', fullname: 'owner/repo' }
      ]
    })
  })
})