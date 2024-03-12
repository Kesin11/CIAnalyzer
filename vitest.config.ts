import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    reporters: [
      "default",
      ["junit", {
        suiteName: "CIAnalyzer tests",
      }],
    ],
    outputFile: "./junit/junit.xml",
  },
})
