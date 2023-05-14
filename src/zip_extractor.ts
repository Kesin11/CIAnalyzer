import fs from 'fs'
import os from 'os'
import path from 'path'
import AdmZip from 'adm-zip'
import crypto from 'crypto'
import { minimatch } from 'minimatch'

const createRandomStr = () => crypto.randomBytes(8).toString('hex')

export class ZipExtractor {
  zipPaths: string[] = []
  constructor() { }

  async rmTmpZip() {
    for (const zipPath of this.zipPaths) {
      try {
        await fs.promises.access(zipPath)
        await fs.promises.unlink(zipPath)
      } catch (_error) {
        console.error(`Error: Could not remove ${zipPath}`)
      }
    }
    this.zipPaths = []
  }

  async put(zipName: string, arraybuffer: ArrayBuffer) {
    const zipPath = path.join(os.tmpdir(), `cianalyzer-${createRandomStr()}-${zipName}`)
    await fs.promises.writeFile(zipPath, Buffer.from(arraybuffer))
    this.zipPaths.push(zipPath)
  }

  extract(globs: string[]): AdmZip.IZipEntry[] {
    const zipEntries = this.zipPaths.flatMap((zipPath) => {
      return new AdmZip(zipPath).getEntries()
    })

    return zipEntries
      .filter((entry) => {
        return !entry.isDirectory &&
          globs.some((glob) => minimatch(entry.entryName, glob))
      })
  }
}
