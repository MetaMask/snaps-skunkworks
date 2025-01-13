/* eslint-disable import/unambiguous, @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, n/no-process-env */

const {
  NodeGlobalsPolyfillPlugin,
} = require('@esbuild-plugins/node-globals-polyfill');
const {
  NodeModulesPolyfillPlugin,
} = require('@esbuild-plugins/node-modules-polyfill');
const { resolve } = require('path');
const { default: tsconfigPaths } = require('vite-tsconfig-paths');

const IS_CI = Boolean(process.env.CI);
const MAX_WORKERS = process.env.MAX_WORKERS
  ? parseInt(process.env.MAX_WORKERS, 10)
  : 1;

const config = {
  runner: [
    'browser',
    {
      headless: true,
      viteConfig: {
        plugins: [tsconfigPaths()],
        optimizeDeps: {
          include: ['@metamask/providers/stream-provider'],
          esbuildOptions: {
            plugins: [
              NodeModulesPolyfillPlugin(),
              NodeGlobalsPolyfillPlugin({
                buffer: true,
              }),
            ],
          },
        },
      },

      coverage: {
        enabled: true,
        exclude: ['**/*.test.browser.ts', '**/test-utils/**'],
        reporter: ['html', 'json-summary', 'text', 'json'],
        reportsDirectory: './coverage/wdio',
      },
    },
  ],

  autoCompileOpts: {
    tsNodeOpts: {
      project: './tsconfig.json',
    },
  },

  specs: ['./src/**/*.test.browser.ts'],

  maxInstances: MAX_WORKERS,
  capabilities: [
    {
      maxInstances: MAX_WORKERS,
      browserName: 'chrome',
    },
    ...(IS_CI
      ? [
          {
            maxInstances: MAX_WORKERS,
            browserName: 'firefox',
          },
        ]
      : []),
  ],

  logLevel: 'error',

  services: [
    [
      'static-server',
      {
        port: 4568,
        middleware: [
          {
            mount: '/worker/executor/',

            // This is a workaround to add the `Access-Control-Allow-Origin`
            // header to the worker bundle, which is required because it is
            // loaded from a different origin than the test page.
            middleware: (_, response) => {
              response.setHeader('Access-Control-Allow-Origin', '*');

              response.type('application/javascript');
              response.sendFile(
                resolve(
                  __dirname,
                  './dist/browserify/worker-executor/bundle.js',
                ),
              );
            },
          },
        ],
        folders: [
          // The iframe execution service bundle.
          {
            mount: '/',
            path: resolve(__dirname, './dist/browserify/iframe'),
          },

          // The web worker execution service bundle.
          {
            mount: '/worker/executor',
            path: resolve(__dirname, './dist/browserify/worker-executor'),
          },
        ],
      },
    ],
  ],

  framework: 'mocha',
  reporters: [
    [
      'spec',
      {
        addConsoleLogs: true,
        showPreface: false,
        realtimeReporting: true,
      },
    ],
  ],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },
};

module.exports.config = config;
