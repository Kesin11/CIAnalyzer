import fs from 'fs'
import path from 'path'
import { Store, AnyObject } from './store'

const defaultDir = path.join('.ci_analyzer', 'last_run')

export class LocalStore implements Store {
  filePath: string
  constructor(service: string, configDir: string, filePath?: string) {

    const _filePath = filePath ?? path.join(defaultDir, `${service}.json`)
    this.filePath = (path.isAbsolute(_filePath))
      ? _filePath
      : path.resolve(configDir, _filePath)
  }

  async read<T extends AnyObject>(): Promise<T> {
    try {
      await fs.promises.access(this.filePath)
      console.info(`(LocalStore) ${this.filePath} was successfully loaded.`)
      return JSON.parse(await fs.promises.readFile(this.filePath, { encoding: 'utf8' }))
    }
    catch (error) {
      console.info(`(LocalStore) ${this.filePath} was not found, empty object is used instead.`)
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

    console.info(`(LocalStore) ${this.filePath} was successfully saved.`)

    return store
  }
}