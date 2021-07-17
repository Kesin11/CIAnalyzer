import { Store, AnyObject } from './store'

export class NullStore implements Store {
  constructor() { }

  async read<T extends AnyObject>(): Promise<T> {
    console.info(`(NullStore) Detect DEBUG mode, nothing is used instead.`)
    return {} as T
  }

  async write<T extends AnyObject> (newStore: T): Promise<T> {
    console.info(`(NullStore) Detect DEBUG mode, skip saving lastRun.`)
    return {} as T
  }
}