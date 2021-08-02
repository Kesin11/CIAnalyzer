import path from 'path'
import { Storage, File } from '@google-cloud/storage'
import { Store, AnyObject } from './store'
import { Logger } from 'tslog'

const defaultDir = path.join('ci_analyzer', 'last_run')

export class GcsStore implements Store {
  file: File
  gcsPath: string
  logger: Logger

  constructor(
    logger: Logger,
    service: string,
    projectId?: string,
    bucket?: string,
    filePath?: string
  ) {
    const fp = filePath ?? path.join(defaultDir, `${service}.json`)

    if (!projectId || !bucket) {
      throw "Must need 'project', 'bucket' params for GCS store"
    }

    this.logger = logger.getChildLogger({ name: GcsStore.name })

    const storage = new Storage({ projectId })
    this.file = storage.bucket(bucket).file(fp)
    this.gcsPath = `gs://${bucket}/${fp}`
  }

  async read<T extends AnyObject>(): Promise<T> {
    const res = await this.file.exists()
    if (res[0]) {
      const data = await this.file.download()
      this.logger.info(`${this.gcsPath} was successfully loaded.`)
      return JSON.parse(data.toString())
    }

    this.logger.info(`${this.gcsPath} was not found, empty object is used instead.`)
    return {} as T
  }

  async write<T extends AnyObject> (newStore: T): Promise<T> {
    // Reload store file
    const reloadedStore = await this.read<T>()
    const store = { ...reloadedStore, ...newStore }

    // Write store file
    await this.file.save(JSON.stringify(store, null, 2))
    this.logger.info(`${this.gcsPath} was successfully saved.`)

    return store
  }
}
