import { parseConfig } from '../../src/config/bitrise_config'

describe('parseConfig', () => {
  describe('repos', () => {
    it('when only string', () => {
      const config = {
        configDir: __dirname,
        bitrise: {
          repos: [ 'owner/repo' ]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          fullname: 'owner/repo',
          slug: undefined,
          testGlob: [],
          customReports: [],
        }]
      })
    })

    it('when object and provide slug', () => {
      const config = {
        configDir: __dirname,
        bitrise: {
          repos: [{
            name: 'owner/repo',
            slug: '1111aaaa2222'
          }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          fullname: 'owner/repo',
          slug: '1111aaaa2222',
          testGlob: [],
          customReports: [],
        }]
      })
  })
})
