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
};