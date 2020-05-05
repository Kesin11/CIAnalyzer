import fs from 'fs'
import path from 'path'

type Store = {
  [repo: string]: {
    lastRun: number
    updatedAt: Date
  }
}

  // Resolve relative path to abs that from repo root directory path.
 const resolveToAbsPath = (filePath: string): string => {
    if (path.isAbsolute(filePath)) {
      return path.resolve(filePath)
    }

    return path.resolve(__dirname, '..', filePath)
  }

const defaultDir = path.join(__dirname, '..', '.ci_analyzer/last_run')

export class LastRunStore {
  filePath: string
  store: Store

  constructor(service: string, filePath?: string) {
    this.filePath = (filePath)
      ? resolveToAbsPath(filePath)
      : resolveToAbsPath(path.join(defaultDir, `${service}.json`))
    this.store = this.readStore(this.filePath)
  }

  private readStore(filePath: string): Store {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }))
    }

    return {}
  }

  setLastRun (repo: string, lastRun: number) {
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
