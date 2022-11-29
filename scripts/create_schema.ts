// Create json schema for ci_analyzer.yaml
import { yamlSchema } from "../src/config/validator"
import zodToJsonSchema from "zod-to-json-schema"
import fs from "node:fs"
import path from "node:path"

const main = async () => {
  const output = process.argv[2]
  const outputPath = (output) ? path.resolve(output) : path.resolve(__dirname, '../schema.json')

  const schema = zodToJsonSchema(yamlSchema, "CIAnalyzer config schema")
  const json = JSON.stringify(schema, undefined, 2)

  await fs.promises.writeFile(path.resolve(outputPath), json, { encoding: "utf8" })
}
main()
