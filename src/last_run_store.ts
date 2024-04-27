import type { Store } from "./store/store.js"
import { LocalStore } from "./store/local_store.js"
import type { LastRunStoreConfig } from "./config/schema.js"
import { GcsStore } from "./store/gcs_store.js"
import type { ArgumentOptions } from "./arg_options.js"
import { NullStore } from "./store/null_store.js"
import type { Logger } from "tslog"

type LastRun<T> = {
  [repo: string]: {
    lastRun: number
    updatedAt: Date
    meta?: T
  }
}

type Metadata = {[key: string]: unknown}

export class LastRunStore<T extends Metadata = Metadata> {
  store: Store
  lastRun: LastRun<T>

  static async init<T extends Metadata>(logger: Logger<unknown>, options: ArgumentOptions, service: string, config?: LastRunStoreConfig) {
    let store
    if (options.debug) {
      store = new NullStore(logger)
    }
    else if (!config) {
      store = new LocalStore(logger, service, options.configDir)
    }
    else if (config.backend === 'local') {
      store = new LocalStore(logger, service, options.configDir, config.path)
    }
    else if (config.backend === 'gcs') {
      store = new GcsStore(logger, service, config.project, config.bucket, config.path)
    }
    else {
      throw new Error(`Error: Unknown LastRunStore.backend type '${(config as any).backend}'`)
    }

    const self = new LastRunStore<T>(store)
    await self.readStore()
    return self
  }

  constructor(store: Store) {
    this.store = store
    this.lastRun = {}
  }

  private async readStore(): Promise<void> {
    this.lastRun = await this.store.read()
  }

  getLastRun (repo: string): number | undefined {
    return this.lastRun[repo]?.lastRun
  }

  setLastRun (repo: string, lastRun: number): void {
    const stored = this.getLastRun(repo) ?? 0
    if (stored >= lastRun) return

    const before = this.lastRun[repo]
    this.lastRun[repo] = {
      ...before,
      lastRun,
      updatedAt: new Date()
    }
  }

  resetLastRun (repo: string): void {
    const before = this.lastRun[repo]

    this.lastRun[repo] = {
      ...before,
      lastRun: 0,
      updatedAt: new Date()
    }
  }

  getMeta (repo: string): T | undefined {
    return this.lastRun[repo]?.meta
  }

  setMeta (repo: string, metadata: T): void {
    const before = this.lastRun[repo]

    this.lastRun[repo] = {
      ...before,
      updatedAt: new Date(),
      meta: metadata
    }
  }

  async save (): Promise<void> {
    this.lastRun = await this.store.write(this.lastRun)
  }
}
