import { describe, it, expect, beforeEach } from "vitest"
import { parseConfig } from '../../src/config/circleci_config'

describe('parseConfig', () => {
  describe('vcsType', () => {
    it('should github when value is repo string', () => {
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
          vcsType: 'github',
          fullname: 'github/owner/repo',
          customReports: [],
        }],
        version: 1
      })
    })

    it('should same as provides when value is object', () => {
      const config = {
        circleci: {
          repos: [{ name: 'owner/repo', vcs_type: 'bitbucket' }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner',
          repo: 'repo',
          vcsType: 'bitbucket',
          fullname: 'bitbucket/owner/repo',
          customReports: [],
        }],
        version: 1
      })
    })

    it('should github when object vcs_type is null', () => {
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
          vcsType: 'github',
          fullname: 'github/owner/repo',
          customReports: [],
        }],
        version: 1
      })
    })
  })

  describe('customReports', () => {
    const customReport = { name: 'custom', paths: ['custom.json'] }

    it('that has not customReports', () => {
      const config = {
        circleci: {
          repos: [{
            name: 'owner/repo',
          }]
        }
      }

      const actual = parseConfig(config)
      expect(actual).toEqual({
        repos: [{
          owner: 'owner', repo: 'repo', vcsType: 'github', fullname: 'github/owner/repo',
          customReports: [],
        }],
        version: 1
      })
    })

    it('that has customReports', () => {
      const config = {
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
          owner: 'owner', repo: 'repo', vcsType: 'github', fullname: 'github/owner/repo',
          customReports: [ customReport ]
        }],
        version: 1
      })
    })
  })

  describe('version', () => {
    it("should 1 when empty", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ]
        }
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(1)
    })

    it("should 1 when version: 1(Number)", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ],
          version: 1,
        },
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(1)
    })

    it("should 1 when version: 1(Number)", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ],
          version: '1',
        },
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(1)
    })

    it("should 2 when version: 2(Number)", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ],
          version: 2,
        }
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(2)
    })

    it("should 2 when version: 2(String)", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ],
          version: '2',
        }
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(2)
    })

    it("should 1 when unknown value", () => {
      const config = {
        circleci: {
          repos: [ 'owner/repo' ],
          version: "1000"
        },
      }

      const actual = parseConfig(config)
      expect(actual!.version).toEqual(1)
    })
  })
})
