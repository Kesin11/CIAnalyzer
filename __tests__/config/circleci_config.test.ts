import { parseConfig } from '../../src/config/circleci_config'

describe('parseConfig', () => {
  describe('vscType', () => {
    it('should github when value is repo string', () => {
      const config = {
        configDir: __dirname,
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
          fullname: 'github/owner/repo',
          customReports: [],
        }]
      })
    })

    it('should same as provides when value is object', () => {
      const config = {
        configDir: __dirname,
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
          fullname: 'bitbucket/owner/repo',
          customReports: [],
        }]
      })
    })

    it('should github when object vsc_type is null', () => {
      const config = {
        configDir: __dirname,
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
          fullname: 'github/owner/repo',
          customReports: [],
        }]
      })
    })
  })

  describe('customReports', () => {
    const customReport = { name: 'custom', paths: ['custom.json'] }

    it('that has not customReports', () => {
      const config = {
        configDir: __dirname,
        circleci: {
          repos: [{
            name: 'owner/repo',
          }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner', repo: 'repo', vscType: 'github', fullname: 'github/owner/repo',
          customReports: [],
        }]
      })
    })

    it('that has customReports', () => {
      const config = {
        configDir: __dirname,
        circleci: {
          repos: [{
            name: 'owner/repo',
            customReports: [ customReport ]
          }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner', repo: 'repo', vscType: 'github', fullname: 'github/owner/repo',
          customReports: [ customReport ]
        }]
      })
    })
  })
})
