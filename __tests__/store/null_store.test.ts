import { NullStore } from '../../src/store/null_store'

describe('LocalStore', () => {
  let store: NullStore
  beforeEach(() => {
    store = new NullStore()
  })

  describe('read', () => {
    it('should return empty object', async () => {
      const actual = await store.read()
      expect(actual).toEqual({})
    })
  })

  describe('save', () => {
    it('should not do anything', async () => {
      const now = new Date()
      const lastRun = {
        'owner/repo': {
          lastRun: 100,
          updatedAt: now,
        }
      }

      const actual = await store.write(lastRun)
      expect(actual).toEqual({})
    })
  })
})
