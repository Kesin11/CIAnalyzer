import * as esbuild from "esbuild";

console.log("Bundle with esbuild...");

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  platform: "node",
  target: "node20",
  outdir: "dist",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  // Workaround for failed starting bundled script with these error.
  // `Error: Dynamic require of "assert" is not supported`
  //
  // ref: https://github.com/evanw/esbuild/issues/1921
  banner: {
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  },
});
