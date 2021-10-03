import { Logger } from 'tslog'
import { ArgumentOptions } from '../../src/arg_options'
import { CircleciClient } from '../../src/client/circleci_client'

const logger = new Logger({ minLevel: 'warn' })
const options = new ArgumentOptions({
  "c": "./dummy.yaml"
})

const allCompletedRuns = [
  { build_nums: [2,3], last_build_num: 3, lifecycles: ['finished','finished'] },
  { build_nums: [4,5], last_build_num: 5, lifecycles: ['finished','finished'] },
  { build_nums: [6,7], last_build_num: 7, lifecycles: ['finished','finished'] },
] as any

const hasInprogressRuns = [
  { build_nums: [2,3], last_build_num: 3, lifecycles: ['finished','finished'] },
  { build_nums: [4,5], last_build_num: 5, lifecycles: ['finished','running'] },
  { build_nums: [6,7], last_build_num: 7, lifecycles: ['running','queued'] },
  { build_nums: [8,9], last_build_num: 9, lifecycles: ['finished','finished'] },
] as any

const hasNotRuns = [
  { build_nums: [2,3], last_build_num: 3, lifecycles: ['finished','finished'] },
  { build_nums: [4],   last_build_num: 4, lifecycles: ['not_run'] },
  { build_nums: [5,6], last_build_num: 6, lifecycles: ['finished','finished'] },
] as any

const hasNotRunAndInprogressRuns = [
  { build_nums: [2],   last_build_num: 2, lifecycles: ['not_run'] },
  { build_nums: [3,4], last_build_num: 4, lifecycles: ['finished','finished'] },
  { build_nums: [5,6], last_build_num: 6, lifecycles: ['running','queued'] },
  { build_nums: [7,8], last_build_num: 8, lifecycles: ['finished','finished'] },
] as any

describe('CircleciClient', () => {
  describe('new() with baseUrl', () => {
    it('should OK when undefined', async () => {
      expect(() => {
        new CircleciClient('DUMMY_TOKEN', logger, options)
      }).toBeTruthy()
    })

    it('should OK when /api/v1.1', async () => {
      const baseUrl = 'https://circleci.com/api/v1.1'
      expect(() => {
        new CircleciClient('DUMMY_TOKEN', logger, options, baseUrl)
      }).toBeTruthy()
    })

    it('should OK when /api/v1.1/', async () => {
      const baseUrl = 'https://circleci.com/api/v1.1/'
      expect(() => {
        new CircleciClient('DUMMY_TOKEN', logger, options, baseUrl)
      }).toBeTruthy()
    })

    it('should throw when /api', async () => {
      const baseUrl = 'https://circleci.com/api'
      expect(() => {
        new CircleciClient('DUMMY_TOKEN', logger, options, baseUrl)
      }).toThrow()
    })

    it('should throw when /api/v2', async () => {
      const baseUrl = 'https://circleci.com/api/v2'
      expect(() => {
        new CircleciClient('DUMMY_TOKEN', logger, options, baseUrl)
      }).toThrow()
    })
  })

  describe('filterWorkflowRuns', () => {
    let client: CircleciClient
    const options = new ArgumentOptions({
      "c": "./dummy.yaml"
    })
    beforeEach(() => {
      client = new CircleciClient('DUMMY_TOKEN', logger, options)
    })

    it('when all finished', async () => {
      const actual = client.filterWorkflowRuns(allCompletedRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([3,5,7])
    })

    it('when has in_pregress', async () => {
      const actual = client.filterWorkflowRuns(hasInprogressRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([3])
    })

    it('when has not_run', async () => {
      const actual = client.filterWorkflowRuns(hasNotRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([3,6])
    })

    it('when has not_run and in_pregress', async () => {
      const actual = client.filterWorkflowRuns(hasNotRunAndInprogressRuns)

      expect(actual.map((run) => run.last_build_num)).toEqual([4])
    })
  })
})
