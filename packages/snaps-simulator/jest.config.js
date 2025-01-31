const deepmerge = require('deepmerge');

const baseConfig = require('../../jest.config.base');

delete baseConfig.transform;

module.exports = deepmerge(baseConfig, {
  coverageThreshold: {
    global: {
      branches: 54.33,
      functions: 60.59,
      lines: 80.54,
      statements: 80.83,
    },
  },
  setupFiles: ['./jest.setup.js'],
  testEnvironment: './jest.environment.js',
  moduleNameMapper: {
    // Mocks out all these file formats when tests are run
    '\\.(css|less|scss|sass|svg)$': '<rootDir>/src/assets/file-mock.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(monaco-editor|react-monaco-editor|react-dnd|dnd-core|@react-dnd/*|@minoru/react-dnd-treeview|nanoid))',
  ],

  // A map from regular expressions to paths to transformers
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          target: 'es2022',
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
              useBuiltins: true,
            },
          },
        },
        sourceMaps: false,
      },
    ],
  },
});
