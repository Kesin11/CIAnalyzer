import { LastRunStore } from '../src/last_run_store'
import os from 'os'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const createRandomStr = () => crypto.randomBytes(8).toString('hex')

describe('LastRunStore', () => {
  const repo = 'owner/repo'
  let storePath: string
  beforeEach(() => {
    storePath = path.join(
      os.tmpdir(),
      `${createRandomStr()}.json`
    )
  })
  afterEach(async () => {
    try {
      await fs.promises.access(storePath)
      await fs.promises.unlink(storePath)
    } catch {}
  })

  describe('new', () => {
    it('this.store should empty object when store file not found', async () => {
      const actual = await LastRunStore.init('github', storePath)
      expect(actual.lastRun).toEqual({})
    })

    it('this.store should same as last run store json', async () => {
      const now = new Date()
      const lastRun = {
        'owner/repo': {
          lastRun: 1,
          updatedAt: now.toISOString(),
        }
      }
      await fs.promises.writeFile(storePath, JSON.stringify(lastRun))

      const actual = await LastRunStore.init('github', storePath)
      expect(actual.lastRun).toEqual(lastRun)
    })
  })

  it('getLastRun', async () => {
    const lastRunStore = await LastRunStore.init('github', storePath)
    lastRunStore.lastRun[repo] = {
      lastRun: 100,
      updatedAt: new Date()
    }

    expect(lastRunStore.getLastRun(repo)).toEqual(100)
  })

  describe('setLastRun', () => {
    it('should accept when value is undefined', async () => {
      const lastRunStore = await LastRunStore.init('github', storePath)
      lastRunStore.setLastRun(repo, 100)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(100)
    })

    it('should accept when value is less than arg', async () => {
      const lastRun = 100
      const lastRunStore = await LastRunStore.init('github', storePath)
      lastRunStore.setLastRun(repo, 99)
      lastRunStore.setLastRun(repo, lastRun)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(lastRun)
    })

    it('should not accept when value is larger than arg', async () => {
      const lastRun = 100
      const lastRunStore = await LastRunStore.init('github', storePath)
      lastRunStore.setLastRun(repo, 101)
      lastRunStore.setLastRun(repo, lastRun)

      expect(lastRunStore.lastRun[repo].lastRun).toEqual(101)
    })
  })

  it('save', async () => {
    const lastRunStore = await LastRunStore.init('github', storePath)
    lastRunStore.setLastRun(repo, 100)
    await lastRunStore.save()

    const writedFile = await fs.promises.readFile(storePath)
    const actual = JSON.parse(writedFile.toString())
    expect(actual).toStrictEqual({
      'owner/repo': {
        lastRun: 100,
        updatedAt: expect.anything()
      }
    })
  })
})
