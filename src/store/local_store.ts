import fs from 'fs'
import path from 'path'
import { Store, AnyObject } from './store'

const defaultDir = path.join('.ci_analyzer', 'last_run')

export class LocalStore implements Store {
  filePath: string
  constructor(service: string, filePath?: string) {

  this.filePath = (filePath)
    ? path.resolve(filePath)
    : path.resolve(path.join(defaultDir, `${service}.json`))
  }

  async read<T extends AnyObject>(): Promise<T> {
    try {
      await fs.promises.access(this.filePath)
      return JSON.parse(await fs.promises.readFile(this.filePath, { encoding: 'utf8' }))
    }
    catch (error) {
      return {} as T
    }
  }

  async write<T extends AnyObject> (newStore: T): Promise<T> {
    // Reload store file
    const reloadedStore = await this.read<T>()
    const store = { ...reloadedStore, ...newStore }

    // Write store file
    const outDir = path.dirname(this.filePath)
    await fs.promises.mkdir(outDir, { recursive: true })
    await fs.promises.writeFile(this.filePath, JSON.stringify(store, null, 2))

    return store
  }
}