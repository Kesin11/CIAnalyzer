import { parseConfig } from '../../src/config/circleci_config'

describe('parseConfig', () => {
  describe('repos', () => {
    it('vscType should github when value is repo string', () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          vscType: 'github',
          fullname: 'github/owner/repo'
        }]
      })
    })

    it('vscType should same as provides when value is object', () => {
      const config = {
        circleci: {
          repos: [{ name: 'owner/repo', vsc_type: 'bitbucket' }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          vscType: 'bitbucket',
          fullname: 'bitbucket/owner/repo'
        }]
      })
    })

    it('vscType should github when object vsc_type is null', () => {
      const config = {
        circleci: {
          repos: [{ name: 'owner/repo' }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          vscType: 'github',
          fullname: 'github/owner/repo'
        }]
      })
    })
  })
})
