import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createJsonSchema } from "../src/config/config.ts";

function getOutputPath(): string {
  const output = process.argv[2];

  if (output) {
    return resolve(output);
  }

  return resolve(import.meta.dirname, "../schema.json");
}

const outputPath = getOutputPath();
const jsonSchema = createJsonSchema();

await writeFile(outputPath, JSON.stringify(jsonSchema, undefined, 2), {
  encoding: "utf8",
});
