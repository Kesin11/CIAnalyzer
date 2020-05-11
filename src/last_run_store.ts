import fs from 'fs'
import path from 'path'

type Store = {
  [repo: string]: {
    lastRun: number
    updatedAt: Date
  }
}

const defaultDir = path.join('.ci_analyzer', 'last_run')

export class LastRunStore {
  filePath: string
  store: Store

  constructor(service: string, filePath?: string) {
    this.filePath = (filePath)
      ? path.resolve(filePath)
      : path.resolve(path.join(defaultDir, `${service}.json`))
    this.store = this.readStore(this.filePath)
  }

  private readStore(filePath: string): Store {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }))
    }

    return {}
  }

  getLastRun (repo: string): number | undefined {
    return this.store[repo]?.lastRun
  }

  setLastRun (repo: string, lastRun: number) {
    const stored = this.getLastRun(repo) ?? 0
    if (stored >= lastRun) return

    this.store[repo] = {
      lastRun,
      updatedAt: new Date()
    }
  }

  save () {
    // Reload store file
    const store = this.readStore(this.filePath)
    const newStore = { ...store, ...this.store }

    // Write store file
    const outDir = path.dirname(this.filePath)
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify(newStore, null, 2))

    this.store = newStore
  }
}
