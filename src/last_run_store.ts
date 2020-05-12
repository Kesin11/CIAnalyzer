import { LocalStore, Store } from "./store/local_store"

type LastRun = {
  [repo: string]: {
    lastRun: number
    updatedAt: Date
  }
}

export class LastRunStore {
  store: Store
  lastRun: LastRun

  static async init(service: string, filePath?: string) {
    const store = new LocalStore(service, filePath)
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
