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
  afterEach(() => {
    if (fs.existsSync(storePath)) {
      fs.unlinkSync(storePath)
    }
  })

  describe('new', () => {
    it('this.store should empty object when store file not found', () => {
      const actual = new LastRunStore('github', storePath)
      expect(actual.store).toEqual({})
    })

    it('this.store should same as last run store json', () => {
      const now = new Date()
      const lastRun = {
        'owner/repo': {
          lastRun: 1,
          updatedAt: now.toISOString(),
        }
      }
      fs.writeFileSync(storePath, JSON.stringify(lastRun))

      const actual = new LastRunStore('github', storePath)
      expect(actual.store).toEqual(lastRun)
    })
  })

  it('getLastRun', () => {
    const lastRunStore = new LastRunStore('github', storePath)
    lastRunStore.store[repo] = {
      lastRun: 100,
      updatedAt: new Date()
    }

    expect(lastRunStore.getLastRun(repo)).toEqual(100)
  })

  it('setLastRun', () => {
    const lastRunStore = new LastRunStore('github', storePath)
    lastRunStore.setLastRun(repo, 100)

    expect(lastRunStore.store[repo].lastRun).toEqual(100)
  })

  it('save', () => {
    const lastRunStore = new LastRunStore('github', storePath)
    lastRunStore.setLastRun(repo, 100)
    lastRunStore.save()

    const writedFile = fs.readFileSync(storePath)
    const actual = JSON.parse(writedFile.toString())
    expect(actual).toStrictEqual({
      'owner/repo': {
        lastRun: 100,
        updatedAt: expect.anything()
      }
    })
  })
})
