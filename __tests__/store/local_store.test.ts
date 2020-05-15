import { LocalStore } from '../../src/store/local_store'
import os from 'os'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const createRandomStr = () => crypto.randomBytes(8).toString('hex')

describe('LocalStore', () => {
  const repo = 'owner/repo'
  let storePath: string
  let localStore: LocalStore
  beforeEach(() => {
    storePath = path.join(
      os.tmpdir(),
      `${createRandomStr()}.json`
    )
    const configDir = path.dirname(storePath)
    localStore = new LocalStore('test', configDir, storePath)
  })
  afterEach(async () => {
    try {
      await fs.promises.access(storePath)
      await fs.promises.unlink(storePath)
    } catch {}
  })

  describe('read', () => {
    it('should return same object as writed JSON', async () => {
      const now = new Date()
      const lastRun = {
        'owner/repo': {
          lastRun: 1,
          updatedAt: now.toISOString(),
        }
      }
      await fs.promises.writeFile(storePath, JSON.stringify(lastRun))

      const actual = await localStore.read()
      expect(actual).toEqual(lastRun)
    })

    it('should return empty object when JSON was not found', async () => {
      const actual = await localStore.read()
      expect(actual).toEqual({})
    })
  })

  it('save', async () => {
    const now = new Date()
    const lastRun = {
      'owner/repo': {
        lastRun: 100,
        updatedAt: now,
      }
    }
    await localStore.write(lastRun)

    const readFile = await fs.promises.readFile(storePath)
    const actual = JSON.parse(readFile.toString())

    expect(actual).toStrictEqual({
      'owner/repo': {
        lastRun: 100,
        updatedAt: expect.anything()
      }
    })
  })
})
