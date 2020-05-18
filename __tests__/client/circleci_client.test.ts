import { CircleciClient } from '../../src/client/circleci_client'

const allCompletedRuns = [
  { build_nums: [2,3], last_build_num: 3, lifecycles: ['finished','finished'] },
  { build_nums: [4,5], last_build_num: 5, lifecycles: ['finished','finished'] },
  { build_nums: [6,7], last_build_num: 7, lifecycles: ['finished','finished'] },
] as any

const hasInprogressRuns = [
  { build_nums: [2,3], last_build_num: 3, lifecycles: ['finished','finished'] },
  { build_nums: [4,5], last_build_num: 5, lifecycles: ['finished','running'] },
  { build_nums: [6,7], last_build_num: 7, lifecycles: ['finished','finished'] },
] as any

describe('CircleciClient', () => {
  describe('filterWorkflowRuns', () => {
    let client: CircleciClient
    beforeEach(() => {
      client = new CircleciClient('DUMMY_TOKEN')
    })

    it('when has not in_pregress runs', async () => {
      const actual = client.filterWorkflowRuns(allCompletedRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([3,5,7])
    })

    it('when has in_pregress runs', async () => {
      const actual = client.filterWorkflowRuns(hasInprogressRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([3])
    })
  })
})
