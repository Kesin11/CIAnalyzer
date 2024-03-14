// Create json schema for ci_analyzer.yaml
import { createJsonSchema } from "../src/config/config.js"
import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
const __dirname = import.meta.dirname;

const output = process.argv[2]
const outputPath = (output) ? resolve(output) : resolve(__dirname, '../schema.json')

const jsonSchema = createJsonSchema()
const json = JSON.stringify(jsonSchema, undefined, 2)

await writeFile(resolve(outputPath), json, { encoding: "utf8" })
