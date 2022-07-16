import { Logger } from 'tslog'
import { Store, AnyObject } from './store'

export class NullStore implements Store {
  #logger: Logger

  constructor(logger: Logger) {
    this.#logger = logger.getChildLogger({ name: NullStore.name })
  }

  async read<T extends AnyObject>(): Promise<T> {
    this.#logger.info(`Detect DEBUG mode, nothing is used instead.`)
    return {} as T
  }

  async write<T extends AnyObject> (newStore: T): Promise<T> {
    this.#logger.info(`Detect DEBUG mode, skip saving lastRun.`)
    return {} as T
  }
}