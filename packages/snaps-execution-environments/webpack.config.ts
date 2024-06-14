// @ts-expect-error - types coming soon
import LavaMoatPlugin from '@lavamoat/webpack';
import { readFileSync } from 'fs';
import HtmlWebpackPlugin from 'html-webpack-plugin';
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
        test: /\.ts$/u,
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
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin()],
    fallback: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      child_process: false,
      crypto: false,
      fs: false,
      os: false,
      path: false,
      stream: require.resolve('stream-browserify'),
      tty: false,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      worker_threads: false,
    },
  },
  plugins: [
    new ProvidePlugin({
      process: 'process/browser',
    }),
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
    // You may randomly need @ts-expect-error here, depending how dependencies resolve. If semver is a smart idea, typescript for webpack config is not
    new LavaMoatPlugin({
      // lockdown: {}, // override lockdown options here if you want
      generatePolicy: true,
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

const configs = [iframeConfig];
export default configs;
