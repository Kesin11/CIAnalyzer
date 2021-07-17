import { Store } from "./store/store"
import { LocalStore } from "./store/local_store"
import { LastRunStoreConfig } from "./config/config"
import { GcsStore } from "./store/gcs_store"
import { ArgumentOptions } from "./arg_options"
import { NullStore } from "./store/null_store"

type LastRun = {
  [repo: string]: {
    lastRun: number
    updatedAt: Date
  }
}

export class LastRunStore {
  store: Store
  lastRun: LastRun

  static async init(options: ArgumentOptions, service: string, configDir: string, config?: LastRunStoreConfig) {
    let store
    if (options.debug) {
      store = new NullStore()
    }
    else if (!config) {
      store = new LocalStore(service, configDir)
    }
    else if (config.backend === 'local') {
      store = new LocalStore(service, configDir, config.path)
    }
    else if (config.backend === 'gcs') {
      store = new GcsStore(service, config.project, config.bucket, config.path)
    }
    else {
      throw `Error: Unknown LastRunStore.backend type '${(config as any).backend}'`
    }

    const self = new LastRunStore(store)
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

    this.lastRun[repo] = {
      lastRun,
      updatedAt: new Date()
    }
  }

  async save (): Promise<void> {
    this.lastRun = await this.store.write(this.lastRun)
  }
}
