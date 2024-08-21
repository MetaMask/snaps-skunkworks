import ReactRefreshPlugin from '@pmmmwh/react-refresh-webpack-plugin';
// eslint-disable-next-line import-x/default
import CopyPlugin from 'copy-webpack-plugin';
import express from 'express';
import FaviconsWebpackPlugin from 'favicons-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';
import { resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';
import {
  ProvidePlugin,
  DllPlugin,
  DllReferencePlugin,
  EnvironmentPlugin,
} from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';
import { merge } from 'webpack-merge';

import packageJson from './package.json';

const vendor = Object.entries(packageJson.dependencies)
  .filter(([, version]) => !version.startsWith('workspace:'))
  .map(([name]) => name);

// This is purposefully not in the `dist` folder, as it will be copied to the
// `dist` folder by the `CopyPlugin` below. This avoids including it twice in
// the final package.
const VENDOR_PATH = resolve(__dirname, 'vendor');
const VENDOR_MANIFEST_PATH = resolve(VENDOR_PATH, 'vendor-manifest.json');

const baseConfig: Configuration = {
  stats: 'errors-only',
  module: {
    rules: [
      {
        test: /snaps-utils\/.*\.tsx?/u,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              transform: {
                react: {
                  runtime: 'automatic',
                  importSource: '@metamask/snaps-sdk',
                  useBuiltins: true,
                },
              },
            },
          },
        },
      },
      {
        test: /\.tsx?$/u,
        exclude: /snaps-utils/u,
        use: {
          loader: 'swc-loader',
        },
      },
      {
        test: /\.m?js$/u,
        include: /node_modules/u,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: resolve(__dirname, 'tsconfig.json'),
        baseUrl: __dirname,
      }),
    ],
    fallback: {
      stream: require.resolve('stream-browserify'),
    },
  },
  plugins: [
    new ProvidePlugin({
      // These Node.js modules are used in some of the stream libs used.
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        minify: TerserPlugin.swcMinify,
      }),
    ],
  },
};

const vendorConfig: Configuration = merge(baseConfig, {
  name: 'vendor',
  devtool: false,
  entry: {
    vendor,
  },
  output: {
    path: VENDOR_PATH,
    filename: '[name].js',
    library: '[name]_[fullhash]',
  },
  module: {
    rules: [
      {
        test: /\.css$/u,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      http: false,
      https: false,
      zlib: false,
    },
  },
  plugins: [
    new DllPlugin({
      path: VENDOR_MANIFEST_PATH,
      name: '[name]_[fullhash]',
    }),
    new MonacoEditorWebpackPlugin({
      languages: ['json', 'typescript'],
      features: ['bracketMatching', 'clipboard', 'hover'],
    }),
  ],
});

const baseAppConfig = merge<Configuration & DevServerConfiguration>(
  baseConfig,
  {
    entry: './src/entry.tsx',
    module: {
      rules: [
        {
          test: /\.(png|jpe?g|gif|svg)$/u,
          type: 'asset',
        },
        {
          test: /\.woff2?$/u,
          type: 'asset/resource',
        },
        {
          test: /\.css$/u,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new DllReferencePlugin({
        manifest: VENDOR_MANIFEST_PATH,
      }),
      new ReactRefreshPlugin(),
      new HtmlWebpackPlugin({
        template: './src/index.html',
      }),
      new FaviconsWebpackPlugin('./src/assets/favicon.svg'),

      // Copy the Webpack vendor files to the output folder.
      new CopyPlugin({
        patterns: [
          {
            from: VENDOR_PATH,
            to: 'vendor',
            toType: 'dir',
          },
        ],
      }),
    ],
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    devServer: {
      port: 8000,
      historyApiFallback: true,
      setupMiddlewares: (middlewares, { app }) => {
        app?.use('/vendor', express.static(VENDOR_PATH));

        return middlewares;
      },
    },
  },
);

const mainConfig = merge(baseAppConfig, {
  name: 'main',
  output: {
    path: resolve(__dirname, 'dist', 'webpack', 'main'),
  },
  plugins: [
    new EnvironmentPlugin({
      SNAPS_TEST: false,
    }),
  ],
});

const testConfig = merge(baseAppConfig, {
  name: 'test',
  devtool: false,
  output: {
    path: resolve(__dirname, 'dist', 'webpack', 'test'),
  },
  plugins: [
    new EnvironmentPlugin({
      SNAPS_TEST: true,
    }),
  ],
});

const configs = [mainConfig, testConfig, vendorConfig];
export default configs;
