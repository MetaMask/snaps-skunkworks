const deepmerge = require('deepmerge');

const baseConfig = require('../../jest.config.base');

module.exports = deepmerge(baseConfig, {
  collectCoverageFrom: [
    './src/**/*.ts',
    '!./src/**/*.test.ts',
    '!./src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 79.87,
      functions: 88.46,
      lines: 89.34,
      statements: 89,
    },
  },
  testTimeout: 2500,
});
