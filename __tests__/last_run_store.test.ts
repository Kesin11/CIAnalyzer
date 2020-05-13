import { LastRunStore } from '../src/last_run_store'
import { Store, AnyObject } from '../src/store/store'

class MockStore implements Store {
  constructor (public data: AnyObject = {}) { }
  async read<T extends AnyObject>(): Promise<T> {
    return this.data as T
  }
  async write<T extends AnyObject> (newStore: T): Promise<T> {
    this.data = { ...newStore }
    return this.data as T
  }
}

describe('LastRunStore', () => {
  const repo = 'owner/repo'
  let mockStore: MockStore
  let lastRunStore: LastRunStore
  beforeEach(() => {
    mockStore = new MockStore()
    lastRunStore = new LastRunStore(mockStore)
  })

  it('getLastRun', async () => {
    lastRunStore.lastRun[repo] = {
      lastRun: 100,
      updatedAt: new Date()
    }

    expect(lastRunStore.getLastRun(repo)).toEqual(100)
  })

  describe('setLastRun', () => {
    it('should accept when current lastRun is undefined', async () => {
      lastRunStore.setLastRun(repo, 100)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(100)
    })

    it('should accept when current lastRun is less than arg', async () => {
      const lastRun = 100
      lastRunStore.setLastRun(repo, 99)
      lastRunStore.setLastRun(repo, lastRun)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(lastRun)
    })

    it('should not accept when current lastRun is larger than arg', async () => {
      const lastRun = 100
      lastRunStore.setLastRun(repo, 101)
      lastRunStore.setLastRun(repo, lastRun)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(101)
    })
  })

  it('save', async () => {
    lastRunStore.setLastRun(repo, 100)
    await lastRunStore.save()

    expect(mockStore.data).toEqual({
      [repo]: {
        lastRun: 100,
        updatedAt: expect.anything(),
      }
    })
  })
})
