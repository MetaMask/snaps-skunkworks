import SnapsWebpackPlugin from '@metamask/snaps-webpack-plugin';
import type { Ora } from 'ora';
import { resolve } from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import type { Configuration } from 'webpack';
import { DefinePlugin, ProgressPlugin, ProvidePlugin } from 'webpack';

import { getFunctionLoader, wasm } from './loaders';
import {
  SnapsBuiltInResolver,
  SnapsBundleWarningsPlugin,
  SnapsStatsPlugin,
  SnapsWatchPlugin,
} from './plugins';
import {
  BROWSERSLIST_FILE,
  getDefaultLoader,
  getDevTool,
  getEnvironmentVariables,
  getFallbacks,
  getImageSVG,
  getProgressHandler,
} from './utils';
import type { ProcessedWebpackConfig } from '../config';

export type WebpackOptions = {
  /**
   * Whether to watch for changes.
   */
  watch?: boolean;

  /**
   * Whether to evaluate the bundle. If this is set, it will override the
   * `evaluate` option in the config object.
   */
  evaluate?: boolean;

  /**
   * The spinner to use for logging.
   */
  spinner?: Ora;
};

/**
 * Get the default Webpack configuration. This is the configuration that will
 * be used if the user doesn't provide a custom Webpack configuration. The
 * configuration is based on the snap config.
 *
 * The default configuration includes:
 *
 * - `SWC` to transpile TypeScript and JavaScript files.
 * - `TerserPlugin` to minify the bundle.
 * - `SnapsWebpackPlugin` to validate the bundle and update the manifest.
 *
 * It can be customized through the `customizeWebpackConfig` function in the
 * snap config, but in most cases, you shouldn't need to do that.
 *
 * @param config - The processed snap Webpack config.
 * @param options - The Webpack options.
 * @returns The default Webpack configuration.
 */
export async function getDefaultConfiguration(
  config: ProcessedWebpackConfig,
  options: WebpackOptions = {
    evaluate: config.evaluate,
  },
): Promise<Configuration> {
  const spinnerText = options.spinner?.text;
  const builtInResolver =
    config.stats.builtIns &&
    new SnapsBuiltInResolver(config.stats.builtIns, options.spinner);

  return {
    /**
     * The target is set to `browserslist` so that Webpack will compile the
     * bundle to support the browsers specified in the `.browserslistrc` file.
     * This Browserslist file contains the browsers that are supported by
     * MetaMask Snaps.
     *
     * @see https://webpack.js.org/configuration/target/
     */
    target: `browserslist:${BROWSERSLIST_FILE}`,

    /**
     * The mode is set to `production` by default, so that Webpack will minify
     * and optimize the bundle.
     *
     * @see https://webpack.js.org/configuration/mode/
     */
    mode: 'production',

    /**
     * The entry point is set to the `input` value from the config object.
     *
     * @see https://webpack.js.org/configuration/entry-context/
     */
    entry: config.input,

    /**
     * The devtool option controls how source maps are generated. We set it to
     * the `sourceMap` value from the config object.
     *
     * @see https://webpack.js.org/configuration/devtool/
     */
    devtool: getDevTool(config.sourceMap),

    /**
     * The stats option controls how much information is printed to the console
     * when Webpack is running. We set it to `none` so that we can control the
     * output ourselves.
     *
     * @see https://webpack.js.org/configuration/stats/
     */
    stats: 'none',

    /**
     * The output options.
     *
     * @see https://webpack.js.org/configuration/output/
     */
    output: {
      /**
       * This indicates whether Webpack should clear the output directory
       * before building. We set it to the `clean` value from the config
       * object.
       *
       * @see https://webpack.js.org/configuration/output/#outputclean
       */
      clean: config.output.clean,

      /**
       * The filename of the bundle. We set it to the `filename` value from
       * the config object.
       *
       * @see https://webpack.js.org/configuration/output/#outputfilename
       */
      filename: config.output.filename,

      /**
       * The path to the output directory. We set it to the `path` value from
       * the config object.
       *
       * @see https://webpack.js.org/configuration/output/#outputpath
       */
      path: config.output.path,

      /**
       * The public path of the bundle. We set it to `/` by default, so that
       * the bundle can be loaded from the root of the server.
       *
       * @see https://webpack.js.org/configuration/output/#outputpublicpath
       */
      publicPath: '/',

      /**
       * The library configuration. This tells Webpack how to export the
       * bundle.
       *
       * @see https://webpack.js.org/configuration/output/#outputlibrary
       */
      library: {
        /**
         * This tells Webpack to export the bundle as a CommonJS module. This
         * is necessary for MetaMask Snaps.
         *
         * @see https://webpack.js.org/configuration/output/#outputlibrarytarget
         */
        type: 'commonjs',
      },

      /**
       * The chunk format. This tells Webpack how to export chunks. This is
       * required because we use browserslist to target browsers, but Snaps are
       * not fully compatible with browser APIs (such as `window` and
       * `document`).
       *
       * @see https://webpack.js.org/configuration/output/#outputchunkformat
       */
      chunkFormat: 'commonjs',
    },

    /**
     * The module configuration. This is where we tell Webpack how to handle
     * different types of files.
     *
     * @see https://webpack.js.org/configuration/module/
     */
    module: {
      rules: [
        {
          test: /\.(js|jsx|mjs|cjs|ts|tsx)$/u,
          exclude: /node_modules/u,
          use: await getDefaultLoader(config),
        },

        /**
         * This allows importing modules that uses `.js` and not `.mjs` for the
         * ES build.
         *
         * @see https://webpack.js.org/configuration/module/#resolvefullyspecified
         */
        {
          test: /\.m?js$/u,
          resolve: {
            fullySpecified: false,
          },
        },

        /**
         * This allows importing `.svg` files as a string.
         */
        config.features.images && {
          test: /\.svg$/u,
          // `asset/source` returns the source as a UTF-8 string.
          type: 'asset/source',
        },

        /**
         * This allows importing `.png` files as a data URL.
         */
        config.features.images && {
          test: /\.png$/u,
          type: 'asset/inline',
          generator: {
            dataUrl: getImageSVG.bind(null, 'image/png'),
          },
        },

        /**
         * This allows importing `.jpe?g` files as a data URL.
         */
        config.features.images && {
          test: /\.jpe?g$/u,
          type: 'asset/inline',
          generator: {
            dataUrl: getImageSVG.bind(null, 'image/jpeg'),
          },
        },

        config.experimental.wasm && {
          test: /\.wasm$/u,
          use: getFunctionLoader(wasm, {}),
        },
      ],
    },

    /**
     * The resolve configuration. This tells Webpack how to resolve imports.
     * We set it to resolve `.js` and `.ts` files.
     *
     * @see https://webpack.js.org/configuration/resolve/
     */
    resolve: {
      /**
       * The extensions to resolve. We set it to resolve `.(c|m)?jsx?` and
       * `.tsx?` files.
       */
      extensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],

      /**
       * The fallback options. This tells Webpack how to handle imports that
       * aren't resolved. By default, we set Node.js built-ins to `false`, so
       * that they are ignored.
       */
      fallback: getFallbacks(config.polyfills),

      /**
       * The plugins to use. We use the {@link SnapsBuiltInResolver} to show
       * warnings about using Node.js built-ins, when no fallback is specified.
       */
      plugins: [builtInResolver],
    },

    /**
     * The plugins to use.
     *
     * @see https://webpack.js.org/configuration/plugins/
     */
    plugins: [
      /**
       * The `SnapsWebpackPlugin` is a Webpack plugin that checks and updates
       * the manifest file, and evaluates the bundle in SES. While not strictly
       * required, it's highly recommended to use this plugin.
       */
      new SnapsWebpackPlugin({
        manifestPath: config.manifest.path,
        writeManifest: config.manifest.update,
        eval: !options.watch && options.evaluate,
      }),

      /**
       * The `SnapsStatsPlugin` is a Webpack plugin that handles the stats
       * output. It's used to show the stats in the terminal, in a format that
       * is easy to read.
       */
      new SnapsStatsPlugin({ verbose: config.stats.verbose }, options.spinner),

      /**
       * The `DefinePlugin` is a Webpack plugin that adds static values to the
       * bundle. We use it to add the `NODE_DEBUG`, `NODE_ENV`, and `DEBUG`
       * environment variables, as well as any custom environment
       * variables (as `process.env`).
       */
      new DefinePlugin(getEnvironmentVariables(config.environment)),

      /**
       * The `ProgressPlugin` is a Webpack plugin that logs the progress of
       * the build. We set it to log the progress to the spinner.
       */
      new ProgressPlugin({
        handler: getProgressHandler(options.spinner, spinnerText),
      }),

      /**
       * The `SnapsBundleWarningPlugin` is a Webpack plugin that shows a
       * warning when the bundle is potentially incompatible with MetaMask
       * Snaps.
       */
      new SnapsBundleWarningsPlugin({
        builtInResolver,
        builtIns: Boolean(config.stats.builtIns),
        buffer: config.stats.buffer,
      }),

      /**
       * The `WatchPlugin` is a Webpack plugin that adds extra files to watch
       * for changes. This is useful for rebuilding the bundle when the
       * manifest file changes.
       */
      options.watch &&
        new SnapsWatchPlugin(
          {
            bundle: resolve(config.output.path, config.output.filename),
            evaluate: options.evaluate,
            files: [config.manifest.path],
          },
          options.spinner,
        ),

      /**
       * The `ProviderPlugin` is a Webpack plugin that automatically load
       * modules instead of having to import or require them everywhere.
       */
      (config.polyfills === true ||
        (config.polyfills !== false && config.polyfills.buffer)) &&
        new ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
    ].filter(Boolean),

    /**
     * The optimization configuration. This tells Webpack how to optimize the
     * bundle. Most of the time, you won't need to change this, as the default
     * options set by the `mode` option are sufficient.
     */
    optimization: {
      minimize: config.output.minimize,

      /**
       * The minimizer to use. We set it to use the `TerserPlugin`.
       */
      minimizer: [
        new TerserPlugin({
          parallel: true,
        }),
      ],
    },

    /**
     * The experiments configuration. This configures which Webpack
     * experiments to enable/disable.
     *
     * @see https://webpack.js.org/configuration/experiments
     */
    experiments: {
      /**
       * Experimental support for top level await.
       *
       * This is unsupported in Snaps and therefore disabled.
       *
       * @see https://webpack.js.org/configuration/experiments/#experimentstoplevelawait
       */
      topLevelAwait: false,
    },

    /**
     * The performance configuration. This tells Webpack how to handle
     * performance hints.
     *
     * @see https://webpack.js.org/configuration/performance/
     */
    performance: {
      /**
       * The hints to show. We set it to `false`, so that we don't get
       * performance hints, as they are not relevant for Snaps.
       *
       * @see https://webpack.js.org/configuration/performance/#performancehints
       */
      hints: false,
    },

    /**
     * The infrastructure logging configuration. This tells Webpack how to
     * log messages.
     *
     * @see https://webpack.js.org/configuration/infrastructure-logging
     */
    infrastructureLogging: {
      /**
       * The level of logging to use. We set it to `none`, so that we can
       * control the output ourselves.
       */
      level: 'none',
    },
  };
}
