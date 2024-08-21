import ReactRefreshPlugin from '@pmmmwh/react-refresh-webpack-plugin';
// eslint-disable-next-line import-x/default
import CopyPlugin from 'copy-webpack-plugin';
import FaviconsWebpackPlugin from 'favicons-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import type { Configuration } from 'webpack';
import { EnvironmentPlugin } from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';

const STATIC_PATH = resolve(__dirname, 'static');

const config: Configuration & Record<'devServer', DevServerConfiguration> = {
  entry: './src/index.tsx',
  stats: 'errors-only',
  output: {
    path: resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/u,
        use: {
          loader: 'swc-loader',
          options: {},
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
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: resolve(__dirname, 'tsconfig.json'),
        baseUrl: __dirname,
      }),
    ],
    /* eslint-disable @typescript-eslint/naming-convention */
    fallback: {
      assert: false,
      child_process: false,
      constants: false,
      crypto: false,
      fs: false,
      http: false,
      https: false,
      module: false,
      stream: false,
      os: false,
      path: false,
      util: false,
      worker_threads: false,
      zlib: false,
    },
    /* eslint-enable @typescript-eslint/naming-convention */
  },
  plugins: [
    new ReactRefreshPlugin(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new EnvironmentPlugin(['NODE_ENV']),
    new FaviconsWebpackPlugin('./src/assets/icon.svg'),
    new CopyPlugin({
      patterns: [
        {
          from: STATIC_PATH,
        },
      ],
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
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  devServer: {
    port: 9000,
    historyApiFallback: true,
  },
};

export default config;
