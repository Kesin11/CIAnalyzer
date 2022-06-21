module.exports = {
  preset: 'ts-jest',
  reporters: [
    'default',
    [ 'jest-junit', {
      suiteName: "CIAnalyzer tests",
      outputDirectory: "junit",
      usePathForSuiteName: "true",
      classNameTemplate: "{classname}",
      titleTemplate: "{title}"
    }]
    // 'jest-junit'
  ],
  testEnvironment: 'node',
  clearMocks: true,
  // https://kulshekhar.github.io/ts-jest/docs/getting-started/options/isolatedModules
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};