#!/usr/bin/env node
import path from "node:path";
import { spawn } from "node:child_process";

const entrypointPath = path.join(import.meta.dirname, "../src/index.ts");

const child = spawn(
  process.execPath,
  ["--import", "tsx", entrypointPath, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

child.once("error", function handleError(error) {
  throw error;
});

child.once("exit", function handleExit(code) {
  process.exit(code ?? 1);
});
