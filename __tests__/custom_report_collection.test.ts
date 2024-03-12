import { describe, it, expect, beforeEach } from "vitest"
import { CustomReportCollection, aggregateCustomReportArtifacts } from '../src/custom_report_collection'
import { CustomReportArtifact } from '../src/client/client'

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

describe('aggregateCustomReportArtifacts', () => {
  it('aggregate CustomReportArtifact[]', () => {
    const artifact1 = { path: 'custom1.json', data: new ArrayBuffer(1) }
    const artifact2 = { path: 'custom2.json', data: new ArrayBuffer(1) }
    const customReportArtifact1: CustomReportArtifact =  new Map([
      [ 'custom1', [artifact1] ],
      [ 'custom2', [artifact2] ],
    ])
    const customReportArtifact2: CustomReportArtifact =  new Map([
      [ 'custom2', [artifact2] ]
    ])

    const actual = aggregateCustomReportArtifacts([customReportArtifact1, customReportArtifact2])
    expect(actual).toStrictEqual(new Map([
      [ 'custom1', [artifact1] ],
      [ 'custom2', [artifact2, artifact2] ],
    ]))
  })
})
