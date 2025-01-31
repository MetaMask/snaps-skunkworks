import { literal, union } from '@metamask/snaps-sdk';
import {
  createFromStruct,
  indent,
  isFile,
  SnapsStructError,
  named,
} from '@metamask/snaps-utils/node';
import {
  array,
  boolean,
  create,
  defaulted,
  define,
  func,
  number,
  object,
  optional,
  record,
  string,
  type,
  unknown,
  empty,
} from '@metamask/superstruct';
import type { Infer } from '@metamask/superstruct';
import { hasProperty } from '@metamask/utils';
import { transform } from '@swc/core';
import type { BrowserifyObject } from 'browserify';
import { dim } from 'chalk';
import { readFile } from 'fs/promises';
import Module from 'module';
import { basename, dirname, resolve } from 'path';
import type { Configuration as WebpackConfiguration } from 'webpack';

import { TranspilationModes } from './builders';
import { ConfigError } from './errors';
import { file } from './structs';
import type { YargsArgs } from './types/yargs';
import { CONFIG_FILE, TS_CONFIG_FILE } from './utils';

const CONFIG_FILES = [CONFIG_FILE, TS_CONFIG_FILE];

/**
 * The configuration for the Snaps CLI, stored as `snap.config.js` or
 * `snap.config.ts` in the root of the project.
 *
 * @deprecated The Browserify bundler is deprecated and will be removed in a
 * future release. Use the Webpack bundler instead.
 */
export type SnapBrowserifyConfig = {
  /**
   * The bundler to use to build the snap. For backwards compatibility, if not
   * specified, Browserify will be used. However, the Browserify bundler is
   * deprecated and will be removed in a future release, so it's recommended to
   * use the Webpack bundler instead.
   */
  bundler: 'browserify';

  /**
   * The options for the Snaps CLI. These are merged with the options passed to
   * the CLI, with the CLI options taking precedence.
   *
   * @deprecated The Browserify bundler is deprecated and will be removed in a
   * future release. Use the Webpack bundler instead.
   */
  cliOptions?: {
    /**
     * The path to the snap bundle file.
     *
     * @default 'dist/bundle.js'
     */
    bundle?: string;

    /**
     * The directory to output the snap to. This is only used if `bundle` is
     * not specified.
     *
     * @default 'dist'
     */
    dist?: string;

    /**
     * Whether to attempt to evaluate the snap in SES. This can catch some errors
     * that would otherwise only be caught at runtime.
     *
     * @default true
     */
    eval?: boolean;

    /**
     * Whether to validate the snap manifest.
     *
     * @default true
     */
    manifest?: boolean;

    /**
     * The name of the bundle file. This is only used if `bundle` is not
     * specified.
     *
     * @default 'bundle.js'
     */
    outfileName?: string;

    /**
     * The port to run the server on.
     *
     * @default 8081
     */
    port?: number;

    /**
     * The host to listen the server on.
     *
     * @default localhost
     */
    host?: string;

    /**
     * The root directory to serve the snap from.
     *
     * @default `process.cwd()`
     */
    root?: string;

    /**
     * Whether to generate source maps for the snap bundle.
     *
     * @default false
     */
    sourceMaps?: boolean;

    /**
     * The path to the snap entry point.
     *
     * @default 'src/index.js'
     */
    src?: string;

    /**
     * Whether to remove comments from the bundle.
     *
     * @default true
     */
    stripComments?: boolean;

    /**
     * Whether to suppress warnings.
     *
     * @default false
     */
    suppressWarnings?: boolean;

    /**
     * The transpilation mode to use, which determines which files are
     * transpiled.
     *
     * - `'localAndDeps'`: Transpile the snap entry point and all dependencies.
     * - `'localOnly'`: Transpile only the snap entry point.
     * - `'none'`: Don't transpile any files.
     *
     * @default 'localOnly'
     */
    transpilationMode?: 'localAndDeps' | 'localOnly' | 'none';

    /**
     * The dependencies to transpile when `transpilationMode` is set to
     * `'localAndDeps'`. If not specified, all dependencies will be transpiled.
     */
    depsToTranspile?: string[];

    /**
     * Whether to show original errors.
     *
     * @default true
     */
    verboseErrors?: boolean;

    /**
     * Whether to write the updated manifest to disk.
     *
     * @default true
     */
    writeManifest?: boolean;

    /**
     * Whether to serve the snap locally.
     *
     * @default true
     */
    serve?: boolean;
  };

  /**
   * A function that can be used to customize the Browserify instance used to
   * build the snap.
   *
   * @param bundler - The Browserify instance.
   * @deprecated The Browserify bundler is deprecated and will be removed in a
   * future release. Use the Webpack bundler instead.
   */
  bundlerCustomizer?: (bundler: BrowserifyObject) => void;
};

/**
 * The configuration for the Snaps CLI, stored as `snap.config.js` or
 * `snap.config.ts` in the root of the project.
 */
export type SnapWebpackConfig = {
  /**
   * The bundler to use to build the snap. For backwards compatibility, if not
   * specified, Browserify will be used. However, the Browserify bundler is
   * deprecated and will be removed in a future release, so it's recommended to
   * use the Webpack bundler instead.
   */
  bundler?: 'webpack';

  /**
   * The path to the snap entry point. This should be a JavaScript or TypeScript
   * file.
   */
  input: string;

  /**
   * Whether to generate source maps for the snap. If `true`, source maps will
   * be generated as separate files. If `'inline'`, source maps will be
   * inlined in the generated JavaScript bundle.
   *
   * @default true
   */
  sourceMap?: boolean | 'inline';

  /**
   * Whether to attempt to evaluate the snap in SES. This can catch some errors
   * that would otherwise only be caught at runtime.
   *
   * @default true
   */
  evaluate?: boolean;

  output?: {
    /**
     * The path to the directory where the snap will be built. This directory
     * will be created if it doesn't exist.
     *
     * If the path is relative, it will be resolved relative to the current
     * working directory.
     *
     * @default 'dist'
     */
    path?: string;

    /**
     * The name of the JavaScript bundle file.
     *
     * @default 'bundle.js'
     */
    filename?: string;

    /**
     * Whether to clean the output directory before building the snap. If
     * `true`, the output directory will be deleted and recreated. Otherwise,
     * the output directory will be left as-is.
     *
     * @default false
     */
    clean?: boolean;

    /**
     * Whether to minimize the snap bundle. If `true`, the bundle will be
     * minified. Otherwise, the bundle will be left as-is.
     *
     * @default true
     */
    minimize?: boolean;
  };

  manifest?: {
    /**
     * The path to the snap manifest file. If the path is relative, it will be
     * resolved relative to the current working directory.
     *
     * @default 'snap.manifest.json'
     */
    path?: string;

    /**
     * Whether to automatically update the manifest. If `true`, the manifest
     * will be updated with the latest shasum of the snap bundle, and some
     * common fields will be updated if they are missing or incorrect. If
     * `false`, the manifest will be left as-is.
     *
     * @default true
     */
    update?: boolean;
  };

  server?: {
    /**
     * Whether to enable the local server. If `true`, the snap will be served
     * from a local server, when running the `watch` command. If `false`, the
     * snap will not be served.
     *
     * @default true
     */
    enabled?: boolean;

    /**
     * The root directory to serve the snap from. If the path is relative, it
     * will be resolved relative to the current working directory.
     *
     * @default `process.cwd()`
     */
    root?: string;

    /**
     * The port to run the server on.
     *
     * @default 8081
     */
    port?: number;

    /**
     * The host to listen the server on.
     *
     * @default localhost
     */
    host?: string;
  };

  /**
   * The environment variables to set when building the snap. These will be
   * available in the snap as `process.env`. In addition to these environment
   * variables, the following environment variables will always be set:
   *
   * - `NODE_DEBUG`: `false`
   * - `NODE_ENV`: `'production'`
   * - `DEBUG`: `false`
   *
   * Any environment variables specified here will override these defaults. You
   * can also override any variables here by setting them in your shell when
   * running the CLI.
   */
  environment?: Record<string, unknown>;

  /**
   * Options that control the logging output of the CLI.
   */
  stats?: {
    /**
     * Whether to enable verbose logging.
     *
     * @default false
     */
    verbose?: boolean;

    /**
     * Whether to log warnings about unresolved built-in modules. If `false`,
     * warnings will not be logged.
     */
    builtIns?:
      | {
          /**
           * The built-in modules to ignore when resolving modules. If a module
           * is ignored, no warning will be logged if it is not resolved.
           */
          ignore?: string[];
        }
      | false;

    /**
     * Whether to log warnings about the use of the `Buffer` global. If `false`,
     * warnings will not be logged. If `true`, the CLI will warn if the `Buffer`
     * global is used, but not provided by Webpack's `DefinePlugin`.
     */
    buffer?: boolean;
  };

  /**
   * Whether to provide polyfills for node builtins. If `true`, all the available
   * polyfills will be provided. If `false` no polyfills will be provided. If a
   * configuration object is passed only the polyfills set to `true` will be provided.
   *
   * @default false
   * @example
   * ```ts
   * polyfills: true
   *
   * // or
   *
   * polyfills: {
   *  assert: true,
   *  buffer: true
   * }
   * ```
   */
  polyfills?:
    | boolean
    | {
        assert?: boolean;
        buffer?: boolean;
        console?: boolean;
        constants?: boolean;
        crypto?: boolean;
        domain?: boolean;
        events?: boolean;
        http?: boolean;
        https?: boolean;
        os?: boolean;
        path?: boolean;
        punycode?: boolean;
        process?: boolean;
        querystring?: boolean;
        stream?: boolean;
        /* eslint-disable @typescript-eslint/naming-convention */
        _stream_duplex?: boolean;
        _stream_passthrough?: boolean;
        _stream_readable?: boolean;
        _stream_transform?: boolean;
        _stream_writable?: boolean;
        string_decoder?: boolean;
        /* eslint-enable @typescript-eslint/naming-convention */
        sys?: boolean;
        timers?: boolean;
        tty?: boolean;
        url?: boolean;
        util?: boolean;
        vm?: boolean;
        zlib?: boolean;
      };

  /**
   * Support for TypeScript type-checking feature.
   *
   * @example
   * {
   *   enabled: true;
   *   configFile: './path/to/tsconfig.json'
   * }
   */
  typescript?: {
    /**
     * Whether to enable TypeScript type-checking feature.
     *
     * @default false
     */
    enabled?: boolean;
    /**
     * Path to tsconfig.json file for the Snap.
     *
     * @default 'tsconfig.json'
     */
    configFile?: string;
  };

  /**
   * Optional features to enable in the CLI.
   *
   * @example
   * {
   *   features: {
   *     images: true,
   *   }
   * }
   */
  features?: {
    /**
     * Whether to enable support for images. If `true`, the Webpack
     * configuration will be modified to support images. If `false`, the
     * Webpack configuration will not be modified.
     *
     * @default true
     */
    images?: boolean;
  };

  /**
   * A function to customize the Webpack configuration used to build the snap.
   * This function will be called with the default Webpack configuration, and
   * should return the modified configuration. If not specified, the default
   * configuration will be used.
   *
   * It's recommended to use the `webpack-merge` package to merge the default
   * configuration with your customizations. The merge function is exported as
   * `merge` from the `@metamask/snaps-cli` package.
   *
   * @example
   * ```ts
   * import type { SnapsConfig } from '@metamask/snaps-cli';
   * import { merge } from '@metamask/snaps-cli';
   *
   * const config: SnapsConfig = {
   *   bundler: 'webpack',
   *   entry: 'src/index.ts',
   *   customizeWebpackConfig: (config) => merge(config, {
   *     module: {
   *       rules: [
   *         {
   *           test: /\.wasm$/,
   *           type: 'assets/resource',
   *         },
   *       ],
   *     },
   *   }),
   * };
   *
   * export default config;
   * ```
   */
  customizeWebpackConfig?: (
    config: WebpackConfiguration,
  ) => WebpackConfiguration;

  /**
   * Experimental features that can be enabled. These features are not
   * guaranteed to be stable, and may be removed or changed in a future release.
   */
  experimental?: {
    /**
     * Whether to enable WebAssembly support. If `true`, the Webpack
     * configuration will be modified to support WebAssembly. If `false`, the
     * Webpack configuration will not be modified.
     *
     * @default false
     */
    wasm?: boolean;
  };
};

/**
 * The configuration for the Snaps CLI, stored as `snap.config.js` or
 * `snap.config.ts` in the root of the project.
 */
export type SnapConfig = SnapBrowserifyConfig | SnapWebpackConfig;

type SnapsBrowserifyBundlerCustomizerFunction = (
  bundler: BrowserifyObject,
) => void;

// This struct is essentially the same as the `func` struct, but it's defined
// separately so that we include the function type in the inferred TypeScript
// type definitions.
const SnapsBrowserifyBundlerCustomizerFunctionStruct =
  define<SnapsBrowserifyBundlerCustomizerFunction>(
    'function',
    func().validator,
  );

export const SnapsBrowserifyConfigStruct = object({
  bundler: literal('browserify'),
  cliOptions: defaulted(
    object({
      bundle: optional(file()),
      dist: defaulted(file(), 'dist'),
      eval: defaulted(boolean(), true),
      manifest: defaulted(boolean(), true),
      port: defaulted(number(), 8081),
      host: defaulted(string(), 'localhost'),
      outfileName: defaulted(string(), 'bundle.js'),
      root: defaulted(file(), process.cwd()),
      sourceMaps: defaulted(boolean(), false),
      src: defaulted(file(), 'src/index.js'),
      stripComments: defaulted(boolean(), true),
      suppressWarnings: defaulted(boolean(), false),
      transpilationMode: defaulted(
        union([literal('localAndDeps'), literal('localOnly'), literal('none')]),
        'localOnly',
      ),
      depsToTranspile: defaulted(array(string()), []),
      verboseErrors: defaulted(boolean(), true),
      writeManifest: defaulted(boolean(), true),
      serve: defaulted(boolean(), true),
    }),
    {},
  ),
  bundlerCustomizer: optional(SnapsBrowserifyBundlerCustomizerFunctionStruct),
});

type SnapsWebpackCustomizeWebpackConfigFunction = (
  config: WebpackConfiguration,
) => WebpackConfiguration;

// This struct is essentially the same as the `func` struct, but it's defined
// separately so that we include the function type in the inferred TypeScript
// type definitions.
const SnapsWebpackCustomizeWebpackConfigFunctionStruct =
  define<SnapsWebpackCustomizeWebpackConfigFunction>(
    'function',
    func().validator,
  );

export const SnapsWebpackConfigStruct = object({
  bundler: defaulted(literal('webpack'), 'webpack'),
  input: defaulted(file(), resolve(process.cwd(), 'src/index.js')),
  sourceMap: defaulted(union([boolean(), literal('inline')]), false),
  evaluate: defaulted(boolean(), true),

  output: defaulted(
    object({
      path: defaulted(file(), resolve(process.cwd(), 'dist')),
      filename: defaulted(string(), 'bundle.js'),
      clean: defaulted(boolean(), false),
      minimize: defaulted(boolean(), true),
    }),
    {},
  ),

  manifest: defaulted(
    object({
      path: defaulted(file(), resolve(process.cwd(), 'snap.manifest.json')),
      update: defaulted(boolean(), true),
    }),
    {},
  ),

  server: defaulted(
    object({
      enabled: defaulted(boolean(), true),
      root: defaulted(file(), process.cwd()),
      port: defaulted(number(), 8081),
      host: defaulted(string(), 'localhost'),
    }),
    {},
  ),

  environment: defaulted(record(string(), unknown()), {}),

  stats: defaulted(
    object({
      verbose: defaulted(boolean(), false),
      builtIns: defaulted(
        union([
          object({ ignore: defaulted(array(string()), []) }),
          literal(false),
        ]),
        {},
      ),
      buffer: defaulted(boolean(), true),
    }),
    {},
  ),

  polyfills: defaulted(
    union([
      boolean(),
      object({
        assert: defaulted(boolean(), false),
        buffer: defaulted(boolean(), false),
        console: defaulted(boolean(), false),
        constants: defaulted(boolean(), false),
        crypto: defaulted(boolean(), false),
        domain: defaulted(boolean(), false),
        events: defaulted(boolean(), false),
        http: defaulted(boolean(), false),
        https: defaulted(boolean(), false),
        os: defaulted(boolean(), false),
        path: defaulted(boolean(), false),
        punycode: defaulted(boolean(), false),
        process: defaulted(boolean(), false),
        querystring: defaulted(boolean(), false),
        stream: defaulted(boolean(), false),
        /* eslint-disable @typescript-eslint/naming-convention */
        _stream_duplex: defaulted(boolean(), false),
        _stream_passthrough: defaulted(boolean(), false),
        _stream_readable: defaulted(boolean(), false),
        _stream_transform: defaulted(boolean(), false),
        _stream_writable: defaulted(boolean(), false),
        string_decoder: defaulted(boolean(), false),
        /* eslint-enable @typescript-eslint/naming-convention */
        sys: defaulted(boolean(), false),
        timers: defaulted(boolean(), false),
        tty: defaulted(boolean(), false),
        url: defaulted(boolean(), false),
        util: defaulted(boolean(), false),
        vm: defaulted(boolean(), false),
        zlib: defaulted(boolean(), false),
      }),
    ]),
    false,
  ),

  typescript: defaulted(
    object({
      enabled: defaulted(boolean(), false),
      configFile: defaulted(file(), 'tsconfig.json'),
    }),
    {},
  ),

  features: defaulted(
    object({
      images: defaulted(boolean(), true),
    }),
    {},
  ),

  customizeWebpackConfig: optional(
    SnapsWebpackCustomizeWebpackConfigFunctionStruct,
  ),

  experimental: defaulted(
    object({
      wasm: defaulted(boolean(), false),
    }),
    {},
  ),
});

export const SnapsConfigStruct = type({
  bundler: defaulted(
    union([literal('browserify'), literal('webpack')]),
    'webpack',
  ),
});

export const LegacyOptionsStruct = union([
  named(
    'object with `transpilationMode` set to `localAndDeps` and `depsToTranspile` set to an array of strings',
    type({
      depsToTranspile: array(string()),
      transpilationMode: literal(TranspilationModes.LocalAndDeps),
      writeManifest: boolean(),
      bundlerCustomizer: optional(
        SnapsBrowserifyBundlerCustomizerFunctionStruct,
      ),
    }),
  ),
  named(
    'object without `depsToTranspile`',
    type({
      depsToTranspile: named('empty array', empty(array())),
      transpilationMode: union([
        literal(TranspilationModes.LocalOnly),
        literal(TranspilationModes.None),
      ]),
      writeManifest: boolean(),
      bundlerCustomizer: optional(
        SnapsBrowserifyBundlerCustomizerFunctionStruct,
      ),
    }),
  ),
]);

export type LegacyOptions = Infer<typeof LegacyOptionsStruct>;

export type ProcessedBrowserifyConfig = Infer<
  typeof SnapsBrowserifyConfigStruct
>;

export type ProcessedWebpackConfig = Infer<typeof SnapsWebpackConfigStruct> & {
  /**
   * The legacy Browserify config, if the bundler is Browserify. This is used
   * to support the legacy config format.
   */
  legacy?: LegacyOptions;
};

export type ProcessedConfig = ProcessedWebpackConfig;

/**
 * Get a validated snap config. This validates the config and adds default
 * values for any missing properties.
 *
 * @param config - The config to validate.
 * @param argv - The CLI arguments.
 * @returns The validated config.
 */
export function getConfig(config: unknown, argv: YargsArgs): ProcessedConfig {
  const prefix = 'The snap config file is invalid';
  const suffix = dim(
    'Refer to the documentation for more information: https://docs.metamask.io/snaps/reference/cli/options/',
  );

  const { bundler } = createFromStruct(
    config,
    SnapsConfigStruct,
    prefix,
    suffix,
  );

  if (bundler === 'browserify') {
    const legacyConfig = createFromStruct(
      config,
      SnapsBrowserifyConfigStruct,
      prefix,
      suffix,
    );

    return getWebpackConfig(mergeLegacyOptions(argv, legacyConfig));
  }

  return createFromStruct(config, SnapsWebpackConfigStruct, prefix, suffix);
}

/**
 * Load a snap config from a file. This supports both JavaScript and TypeScript
 * config files, in the CommonJS module format and the ES module format.
 *
 * This assumes that the config file exports a default object, either through
 * `module.exports` or `export default`.
 *
 * @param path - The full path to the config file.
 * @param argv - The CLI arguments.
 * @returns The validated config.
 * @throws If the config file is invalid, or if the config file does not have a
 * default export.
 */
export async function loadConfig(path: string, argv: YargsArgs) {
  try {
    const contents = await readFile(path, 'utf8');
    const source = await transform(contents, {
      swcrc: false,
      jsc: {
        parser: {
          syntax: 'typescript',
        },
      },
      module: {
        type: 'commonjs',
      },
    });

    const config = new Module(path);

    // @ts-expect-error - This function is not typed.
    config.paths = Module._nodeModulePaths(dirname(path));

    // @ts-expect-error - This function is not typed.
    config._compile(source.code, path);

    if (!hasProperty(config.exports, 'default')) {
      return getConfig(config.exports, argv);
    }

    return getConfig(config.exports.default, argv);
  } catch (error) {
    if (error instanceof SnapsStructError) {
      throw new ConfigError(error.message);
    }

    throw new ConfigError(
      `Unable to load snap config file at "${path}".\n\n${indent(
        error.message,
      )}`,
    );
  }
}

/**
 * Resolve a snap config. This function will look for a `snap.config.js` or
 * `snap.config.ts` file in the current or specified directory.
 *
 * @param path - The path to resolve the snap config from. Defaults to the
 * current working directory.
 * @param argv - The CLI arguments.
 * @returns The resolved and validated snap config.
 * @throws If a snap config could not be found.
 */
export async function resolveConfig(path: string, argv: YargsArgs) {
  for (const configFile of CONFIG_FILES) {
    const filePath = resolve(path, configFile);
    if (await isFile(filePath)) {
      return await loadConfig(filePath, argv);
    }
  }

  throw new ConfigError(
    `Could not find a "snap.config.js" or "snap.config.ts" file in the current or specified directory ("${path}").`,
  );
}

/**
 * Get a snap config from the CLI arguments. This will either load the config
 * from the specified config file, or resolve the config from the current
 * working directory.
 *
 * @param argv - The CLI arguments.
 * @param cwd - The current working directory. Defaults to `process.cwd()`.
 * @returns The resolved and validated snap config.
 */
export async function getConfigByArgv(
  argv: YargsArgs,
  cwd: string = process.cwd(),
) {
  if (argv.config) {
    if (!(await isFile(argv.config))) {
      throw new ConfigError(
        `Could not find a config file at "${argv.config}". Make sure that the path is correct.`,
      );
    }

    return await loadConfig(argv.config, argv);
  }

  return await resolveConfig(cwd, argv);
}

/**
 * Merge legacy CLI options into the config. This is used to support the legacy
 * config format, where options can be specified both in the config file and
 * through CLI flags.
 *
 * @param argv - The CLI arguments.
 * @param config - The config to merge the CLI options into.
 * @returns The config with the CLI options merged in.
 * @deprecated This function is only used to support the legacy config format.
 */
export function mergeLegacyOptions(
  argv: YargsArgs,
  config: ProcessedBrowserifyConfig,
) {
  const cliOptions = Object.keys(config.cliOptions).reduce<
    ProcessedBrowserifyConfig['cliOptions']
  >((accumulator, key) => {
    if (argv[key] !== undefined) {
      return {
        ...accumulator,
        [key]: argv[key],
      };
    }

    return accumulator;
  }, config.cliOptions);

  return {
    ...config,
    cliOptions,
  };
}

/**
 * Get a Webpack config from a legacy browserify config. This is used to
 * support the legacy config format, and convert it to the new format.
 *
 * @param legacyConfig - The legacy browserify config.
 * @returns The Webpack config.
 */
export function getWebpackConfig(
  legacyConfig: ProcessedBrowserifyConfig,
): ProcessedWebpackConfig {
  const defaultConfig = create(
    { bundler: 'webpack' },
    SnapsWebpackConfigStruct,
  );

  // The legacy config has two options for specifying the output path and
  // filename: `bundle`, and `dist` + `outfileName`. If `bundle` is specified,
  // we use that as the output path and filename. Otherwise, we use `dist` and
  // `outfileName`.
  const path = legacyConfig.cliOptions.bundle
    ? dirname(legacyConfig.cliOptions.bundle)
    : legacyConfig.cliOptions.dist;

  const filename = legacyConfig.cliOptions.bundle
    ? basename(legacyConfig.cliOptions.bundle)
    : legacyConfig.cliOptions.outfileName;

  return {
    ...defaultConfig,
    input: legacyConfig.cliOptions.src,
    evaluate: legacyConfig.cliOptions.eval,
    sourceMap: legacyConfig.cliOptions.sourceMaps,
    output: {
      path,
      filename,

      // The legacy config has an option to remove comments from the bundle, but
      // the terser plugin does this by default, so we only enable the terser if
      // the legacy config has `stripComments` set to `true`. This is not a
      // perfect solution, but it's the best we can do without breaking the
      // legacy config.
      minimize: legacyConfig.cliOptions.stripComments,

      // The legacy config does not have a `clean` option, so we default to
      // `false` here.
      clean: false,
    },
    manifest: {
      // The legacy config does not have a `manifest` option, so we default to
      // `process.cwd()/snap.manifest.json`.
      path: resolve(process.cwd(), 'snap.manifest.json'),
      update: legacyConfig.cliOptions.writeManifest,
    },
    server: {
      enabled: legacyConfig.cliOptions.serve,
      port: legacyConfig.cliOptions.port,
      root: legacyConfig.cliOptions.root,
      host: legacyConfig.cliOptions.host,
    },
    stats: {
      verbose: false,

      // These plugins are designed to be used with the modern config format, so
      // we disable them for the legacy config format.
      builtIns: false,
      buffer: false,
    },
    legacy: createFromStruct(
      {
        ...legacyConfig.cliOptions,
        bundlerCustomizer: legacyConfig.bundlerCustomizer,
      },
      LegacyOptionsStruct,
      'Invalid Browserify CLI options',
    ),
  };
}
