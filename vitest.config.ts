import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    reporters: [
      "default",
      [
        "junit",
        {
          suiteName: "CIAnalyzer tests",
        },
      ],
    ],
    outputFile: "./junit/junit.xml",
    coverage: {
      reporter: ["html", "lcov"],
    },
  },
});
