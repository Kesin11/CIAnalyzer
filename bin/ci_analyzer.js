#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const entrypointPath = path.join(import.meta.dirname, "../src/index.ts");
const require = createRequire(import.meta.url);
const tsxLoaderPath = require.resolve("tsx");

const child = spawn(
  process.execPath,
  ["--import", tsxLoaderPath, entrypointPath, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

child.once("error", function handleError(error) {
  throw error;
});

child.once("exit", function handleExit(code) {
  process.exit(code ?? 1);
});
