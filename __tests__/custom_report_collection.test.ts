import { CustomReportCollection } from '../src/custom_report_collection'

describe('CustomReportCollection', () => {
  let customReportCollection: CustomReportCollection
  const customReport = {
    workflowId: 'test',
    workflowRunId: 'test-1',
    createdAt: new Date,
    foo: 'Foo',
    hoge: 'Hoge'
  }
  beforeEach(() => {
    customReportCollection = new CustomReportCollection()
    customReportCollection.set('custom', [customReport])
  })

  it('set', async () => {
    expect(customReportCollection.customReports.get('custom')).toStrictEqual([customReport])
  })

  it('get', async () => {
    expect(customReportCollection.get('custom')).toStrictEqual([customReport])
  })

  describe('aggregate()', () => {
    it('same key reports should be concat', async () => {
      const anotherReport = { ...customReport, ...{foo: 'Foofoo', hoge: 'Hogehoge'}}
      const anotherCollection = new CustomReportCollection()
      anotherCollection.set('custom', [anotherReport])

      customReportCollection.aggregate(anotherCollection)
      expect(customReportCollection.customReports.get('custom')).toStrictEqual([customReport, anotherReport])
    })

    it('other keys register in this.customReports', async () => {
      const anotherReport = {
        workflowId: 'test',
        workflowRunId: 'test-1',
        createdAt: new Date,
        another: 'Another',
      }
      const anotherCollection = new CustomReportCollection()
      anotherCollection.set('another', [anotherReport])

      const expected = new Map()
      expected.set('custom', [customReport])
      expected.set('another', [anotherReport])

      customReportCollection.aggregate(anotherCollection)
      expect(customReportCollection.customReports).toStrictEqual(expected)
    })
  })
})
