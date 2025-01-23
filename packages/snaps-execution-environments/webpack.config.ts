// @ts-expect-error - types coming soon
import LavaMoatPlugin from '@lavamoat/webpack';
import { readFileSync } from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { isBuiltin } from 'node:module';
import { resolve } from 'path';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';
import { ProvidePlugin } from 'webpack';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { merge } from 'webpack-merge';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const swc = require('../../.swcrc.build.json');
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires

const baseConfig: Configuration = {
  mode: 'production',
  // devtool: 'source-map', // the default eval-driven inline sourcemap will fail with lavamoat
  output: {
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/u,
        use: {
          loader: 'swc-loader',
          options: {
            ...swc,
            module: {
              type: 'es6',
            },
          },
        },
      },
      {
        test: /\.m?js$/u,
        resolve: {
          // Fixes an issue with `@metamask/key-tree`. We can remove this after
          // releasing a new version of `@metamask/key-tree`.
          fullySpecified: false,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: resolve(__dirname, 'tsconfig.json'),
        baseUrl: __dirname,
      }),
    ],
    fallback: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      child_process: false,
      crypto: false,
      fs: false,
      os: false,
      path: false,
      stream: require.resolve('stream-browserify'),
      tty: false,
      zlib: false,
      http: false,
      https: false,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      worker_threads: false,
    },
  },
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],
};

const iframeConfig: Configuration = merge(baseConfig, {
  entry: './src/iframe/index.ts',
  output: {
    path: resolve(__dirname, 'dist/webpack/iframe'),
  },
  plugins: [
    new ProvidePlugin({
      process: 'process/browser',
    }),
    // You may randomly need @ts-expect-error here, depending how dependencies resolve. If semver is a smart idea, typescript for webpack config is not
    new LavaMoatPlugin({
      // lockdown: {}, // override lockdown options here if you want
      generatePolicy: true,
      policyLocation: resolve(__dirname, 'lavamoat/webpack/iframe'),
      diagnosticsVerbosity: 1,
      readableResourceIds: true,
      emitPolicySnapshot: true, // puts the result of merging policy with override that was used for the bundle alongside the bundle for human review
    }),
    new HtmlWebpackPlugin({
      template: './src/iframe/template.html',
      templateParameters: {
        lockdownScript: readFileSync(require.resolve('ses')), // this could be provided as a static field on the plugin reference
      },
    }),
  ],
});

const nodeThreadConfig: Configuration = merge(baseConfig, {
  target: 'node',
  entry: './src/node-thread/index.ts',
  output: {
    path: resolve(__dirname, 'dist/webpack/node-thread'),
  },
  plugins: [
    // You may randomly need @ts-expect-error here, depending how dependencies resolve. If semver is a smart idea, typescript for webpack config is not
    new LavaMoatPlugin({
      // lockdown: {}, // override lockdown options here if you want
      generatePolicy: true,
      policyLocation: resolve(__dirname, 'lavamoat/webpack/node-thread'),
      isBuiltin,
      inlineLockdown: /bundle.js/u,
      diagnosticsVerbosity: 1,
      readableResourceIds: true,
      emitPolicySnapshot: true, // puts the result of merging policy with override that was used for the bundle alongside the bundle for human review
    }),
  ],
  optimization: {
    minimize: false,
  },
});

const nodeProcessConfig: Configuration = merge(baseConfig, {
  target: 'node',
  entry: './src/node-process/index.ts',
  output: {
    path: resolve(__dirname, 'dist/webpack/node-process'),
  },
  plugins: [
    // You may randomly need @ts-expect-error here, depending how dependencies resolve. If semver is a smart idea, typescript for webpack config is not
    new LavaMoatPlugin({
      // lockdown: {}, // override lockdown options here if you want
      generatePolicy: true,
      policyLocation: resolve(__dirname, 'lavamoat/webpack/node-process'),
      isBuiltin,
      inlineLockdown: /bundle.js/u,
      diagnosticsVerbosity: 1,
      readableResourceIds: true,
      emitPolicySnapshot: true, // puts the result of merging policy with override that was used for the bundle alongside the bundle for human review
    }),
  ],
});

const configs = [iframeConfig, nodeThreadConfig, nodeProcessConfig];
export default configs;
