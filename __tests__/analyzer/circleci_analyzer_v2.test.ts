import { CircleciAnalyzerV2 } from '../../src/analyzer/circleci_analyzer_v2'

describe('CircleciAnalyzerV2', () => {
  describe('htmlBaseUrl', () => {
    it('should be https://app.circleci.com when baseUrl is undeifned', async () => {
      const analyzer = new CircleciAnalyzerV2()
      expect(analyzer.htmlBaseUrl).toEqual('https://app.circleci.com')
    })

    it('should be https://app.{domain} when baseUrl is https://{domain}/api', async () => {
      const analyzer = new CircleciAnalyzerV2('https://circleci.foobar.com/api')
      expect(analyzer.htmlBaseUrl).toEqual('https://app.circleci.foobar.com')
    })

    it('should be https://app.{domain} when baseUrl is https://{domain}/api/somesuffix', async () => {
      const analyzer = new CircleciAnalyzerV2('https://circleci.foobar.com/api/somesuffix')
      expect(analyzer.htmlBaseUrl).toEqual('https://app.circleci.foobar.com')
    })
  })
})
