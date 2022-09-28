module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/**/src/**/*.ts',
    '!<rootDir>/**/src/**/*.test.ts',
  ],
  coverageReporters: ['clover', 'json', 'lcov', 'text', 'json-summary'],
  coveragePathIgnorePatterns: ['/node_modules/', '/mocks/', '/test/'],
  coverageThreshold: {
    global: {
      branches: 85.07,
      functions: 94.93,
      lines: 94.47,
      statements: 94.55,
    },
  },
  projects: [
    {
      preset: 'ts-jest',
      testMatch: ['<rootDir>/src/services/iframe/*.test.ts'],
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        resources: 'usable',
        runScripts: 'dangerously',
        customExportConditions: ['node', 'node-addons'],
      },
    },
    {
      preset: 'ts-jest',
      testPathIgnorePatterns: ['<rootDir>/src/services/iframe/*'],
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
      },
      testRegex: ['\\.test\\.(ts|js)$'],
    },
  ],
  silent: true,
  testTimeout: 5000,
};
