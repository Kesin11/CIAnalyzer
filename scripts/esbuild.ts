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
    // yargs@18 bundles its own createRequire import.
    // Use a namespaced import to avoid redeclaration collisions.
    js: "import * as __module from 'node:module';const require = __module.createRequire(import.meta.url);",
  },
});
