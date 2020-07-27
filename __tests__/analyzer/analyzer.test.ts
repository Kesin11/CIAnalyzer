import { convertToReportTestSuites, ReportTestSuites } from '../../src/analyzer/analyzer'
import { TestSuites } from 'junit2json'

describe('Analyzer', () => {
  describe('convertToReportTestSuites', () => {
    describe('Omit some properties', () => {
      let testSuites: TestSuites
    
      beforeEach(() => {
        testSuites = {
          tests: 1,
          failures: 1,
          testsuite: [{
            name: 'testsuite',
            tests: 1,
            failures: 1,
            testcase: [] // Assigning testcase at each testcase
          }]
        }
      })

      it('testcase.error', async () => {
        const testCase = [{
          name: 'testcase',
          classname: 'test',
          error: [{
            inner: 'assert xxx',
          }]
        }]
        testSuites.testsuite[0].testcase = testCase

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase
        ).not.toHaveProperty('error')
      })

      it('testcase.failure', async () => {
        const testCase = [{
          name: 'testcase',
          classname: 'test',
          failure: [{
            inner: 'assert xxx',
          }] 
        }]
        testSuites.testsuite[0].testcase = testCase

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase
        ).not.toHaveProperty('failure')
      })

      it('testcase.system-out', async () => {
        const testCase = [{
          name: 'testcase',
          classname: 'test',
          "system-out": ['stdout']
        }]
        testSuites.testsuite[0].testcase = testCase

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase
        ).not.toHaveProperty('system-out')
      })

      it('testcase.system-out', async () => {
        const testCase = [{
          name: 'testcase',
          classname: 'test',
          skipped: [{
            message: 'skip reason'
          }]
        }]
        testSuites.testsuite[0].testcase = testCase

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase
        ).not.toHaveProperty('skipped')
      })

      it('testcase.system-err', async () => {
        const testCase = [{
          name: 'testcase',
          classname: 'test',
          "system-err": ['stderr']
        }]
        testSuites.testsuite[0].testcase = testCase

        expect(
          convertToReportTestSuites(testSuites).testsuite[0].testcase
        ).not.toHaveProperty('system-err')
      })

      it('testsuite.system-out', async () => {
        const testSuite = [{
          name: 'testsuite',
          tests: 1,
          testcase: [{
            name: 'testcase',
            classname: 'test',
          }],
          "system-out": ['stdout']
        }]
        testSuites.testsuite = testSuite

        expect(
          convertToReportTestSuites(testSuites).testsuite
        ).not.toHaveProperty('system-out')
      })

      it('testsuite.system-err', async () => {
        const testSuite = [{
          name: 'testsuite',
          tests: 1,
          testcase: [{
            name: 'testcase',
            classname: 'test',
          }],
          "system-err": ['stderr']
        }]
        testSuites.testsuite = testSuite

        expect(
          convertToReportTestSuites(testSuites).testsuite
        ).not.toHaveProperty('system-err')
      })

      it('testSuites has not failure', async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [{
            name: 'testsuite',
            tests: 1,
            testcase: [{
              name: 'testcase',
              classname: 'test',
            }]
          }]
        }
        const expected = JSON.parse(JSON.stringify(testSuites))
        expected.testsuite[0].testcase[0].successCount = expect.anything()

        expect(convertToReportTestSuites(testSuites)).toStrictEqual(expected)
      })
    })

    describe('Add some properties', () => {
      it('successCount = 1 when testcase is success', async () => {
        const testSuites: TestSuites = {
          tests: 1,
          testsuite: [{
            name: 'testsuite',
            tests: 1,
            testcase: [{
              name: 'testcase',
              classname: 'test',
            }]
          }]
        }
        const expected = JSON.parse(JSON.stringify(testSuites))
        expected.testsuite[0].testcase[0].successCount = 1

        expect(convertToReportTestSuites(testSuites)).toStrictEqual(expected)
      })

      it('successCount = 0 when testcase is failed', async () => {
        const testSuites: TestSuites = {
          tests: 1,
          failures: 1,
          testsuite: [{
            name: 'testsuite',
            tests: 1,
            failures: 1,
            testcase: [{
              name: 'testcase',
              classname: 'test',
              failure: [{
                inner: 'assert xxx'
              }]
            }]
          }]
        }
        const expected = JSON.parse(JSON.stringify(testSuites))
        delete expected.testsuite[0].testcase[0].failure
        expected.testsuite[0].testcase[0].successCount = 0

        expect(convertToReportTestSuites(testSuites)).toStrictEqual(expected)
      })

      it('successCount = 0 when testcase is error', async () => {
        const testSuites: TestSuites = {
          tests: 1,
          failures: 1,
          testsuite: [{
            name: 'testsuite',
            tests: 1,
            failures: 1,
            testcase: [{
              name: 'testcase',
              classname: 'test',
              error: [{
                inner: 'some error'
              }]
            }]
          }]
        }
        const expected = JSON.parse(JSON.stringify(testSuites))
        delete expected.testsuite[0].testcase[0].error
        expected.testsuite[0].testcase[0].successCount = 0

        expect(convertToReportTestSuites(testSuites)).toStrictEqual(expected)
      })
    })
  })
})
