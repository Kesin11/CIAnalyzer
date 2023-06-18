// Create json schema for ci_analyzer.yaml
import { createJsonSchema } from "../src/config/config"
import fs from "node:fs"
import path from "node:path"

const main = async () => {
  const output = process.argv[2]
  const outputPath = (output) ? path.resolve(output) : path.resolve(__dirname, '../schema.json')

  const jsonSchema = createJsonSchema()
  const json = JSON.stringify(jsonSchema, undefined, 2)

  await fs.promises.writeFile(path.resolve(outputPath), json, { encoding: "utf8" })
}
main()
