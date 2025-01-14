import { assert, hasProperty, isObject } from '@metamask/utils';
import { bold, dim, red, yellow } from 'chalk';
import { isBuiltin } from 'module';
import type { Ora } from 'ora';
import type {
  Compiler,
  ProvidePlugin,
  Resolver,
  StatsError,
  WebpackPluginInstance,
} from 'webpack';
import { WebpackError } from 'webpack';

import { evaluate } from '../commands/eval';
import { error, getErrorMessage, info, warn } from '../utils';
import { formatText, pluralize } from './utils';

export type SnapsStatsPluginOptions = {
  /**
   * Whether to log the verbose stats.
   */
  verbose?: boolean;
};

/**
 * A plugin that logs the stats after compilation. This is useful for logging
 * the number of files compiled, and the time taken to compile them.
 */
export class SnapsStatsPlugin implements WebpackPluginInstance {
  /**
   * The options for the plugin.
   */
  readonly options: SnapsStatsPluginOptions;

  /**
   * The spinner to use for logging.
   */
  readonly #spinner?: Ora;

  constructor(
    options: SnapsStatsPluginOptions = {
      verbose: false,
    },
    spinner?: Ora,
  ) {
    this.options = options;
    this.#spinner = spinner;
  }

  /**
   * Apply the plugin to the Webpack compiler.
   *
   * @param compiler - The Webpack compiler.
   */
  apply(compiler: Compiler) {
    compiler.hooks.afterDone.tap(this.constructor.name, (stats) => {
      if (!stats) {
        return;
      }

      const { modules, time, errors, warnings } = stats.toJson();

      assert(modules, 'Modules must be defined in stats.');
      assert(time, 'Time must be defined in stats.');

      if (errors?.length) {
        const formattedErrors = errors
          .map((statsError) => this.#getStatsErrorMessage(statsError))
          .join('\n\n');

        error(
          `Compiled ${modules.length} ${pluralize(
            modules.length,
            'file',
          )} in ${time}ms with ${errors.length} ${pluralize(
            errors.length,
            'error',
          )}.\n\n${formattedErrors}\n`,
          this.#spinner,
        );

        this.#spinner?.stop();

        process.exitCode = 1;
        return;
      }

      if (warnings?.length) {
        const formattedWarnings = warnings
          .map((statsWarning) =>
            this.#getStatsErrorMessage(statsWarning, yellow),
          )
          .join('\n\n');

        warn(
          `Compiled ${modules.length} ${pluralize(
            modules.length,
            'file',
          )} in ${time}ms with ${warnings.length} ${pluralize(
            warnings.length,
            'warning',
          )}.\n\n${formattedWarnings}\n`,
          this.#spinner,
        );
      } else {
        info(
          `Compiled ${modules.length} ${pluralize(
            modules.length,
            'file',
          )} in ${time}ms.`,
          this.#spinner,
        );
      }

      if (compiler.watchMode) {
        // The spinner may be restarted by the watch plugin, outside of the
        // `executeSteps` flow, so we stop it here just in case.
        this.#spinner?.succeed('Done!');
      }
    });
  }

  /**
   * Get the error message for the given stats error.
   *
   * @param statsError - The stats error.
   * @param color - The color to use for the error message.
   * @returns The error message.
   */
  #getStatsErrorMessage(statsError: StatsError, color = red) {
    const baseMessage = this.options.verbose
      ? getErrorMessage(statsError)
      : statsError.message;

    const [first, ...rest] = baseMessage.split('\n');

    return [
      color(formatText(`• ${first}`, 4, 2)),
      ...rest.map((message) => formatText(color(message), 4)),
      statsError.details && `\n${formatText(dim(statsError.details), 6)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}

/**
 * The options for the {@link SnapsWatchPlugin}.
 */
export type SnapsWatchPluginOptions = {
  /**
   * The bundle path. This is the file that will be evaluated, if the `evaluate`
   * option is set.
   */
  bundle?: string;

  /**
   * Whether to evaluate the bundle. This only applies if the `bundle` option is
   * set.
   */
  evaluate?: boolean;

  /**
   * The extra files to watch.
   */
  files?: string[];
};

/**
 * A plugin that adds extra files to watch. This is useful for watching files
 * that are not imported by the entry point, such as the `snap.manifest.json`
 * file.
 */
export class SnapsWatchPlugin implements WebpackPluginInstance {
  /**
   * The options for the plugin.
   */
  readonly options: SnapsWatchPluginOptions;

  /**
   * The spinner to use for logging.
   */
  readonly #spinner?: Ora;

  constructor(options: SnapsWatchPluginOptions, spinner?: Ora) {
    this.options = options;
    this.#spinner = spinner;
  }

  /**
   * Apply the plugin to the Webpack compiler.
   *
   * @param compiler - The Webpack compiler.
   */
  apply(compiler: Compiler) {
    compiler.hooks.invalid.tap(this.constructor.name, (file) => {
      this.#spinner?.start();
      info(`Changes detected in ${yellow(file)}, recompiling.`, this.#spinner);
    });

    compiler.hooks.afterEmit.tapPromise(
      this.constructor.name,
      async ({ fileDependencies }) => {
        this.options.files?.forEach(
          fileDependencies.add.bind(fileDependencies),
        );

        if (this.options.bundle && this.options.evaluate) {
          await this.#safeEvaluate(this.options.bundle);
        }
      },
    );
  }

  /**
   * Safely evaluate the bundle at the given path. If an error occurs, it will
   * be logged to the console, rather than throwing an error.
   *
   * This function should never throw an error.
   *
   * @param bundlePath - The path to the bundle.
   */
  async #safeEvaluate(bundlePath: string) {
    try {
      await evaluate(bundlePath);
      info(`Snap bundle evaluated successfully.`, this.#spinner);
    } catch (evaluateError) {
      error(evaluateError.message, this.#spinner);
    }
  }
}

/**
 * Webpack's resolver plugin interface, which is not exported by Webpack.
 */
type ResolverPlugin = {
  apply: (resolver: Resolver) => void;
};

/**
 * The options for the {@link SnapsBuiltInResolver}.
 */
export type SnapsBuiltInResolverOptions = {
  /**
   * The built-in modules to ignore.
   */
  ignore?: string[];
};

/**
 * A plugin that logs a message when a built-in module is not resolved. The
 * MetaMask Snaps CLI does not support built-in modules by default, and this
 * plugin is used to warn the user when they try to import a built-in module,
 * when no fallback is configured.
 */
export class SnapsBuiltInResolver implements ResolverPlugin {
  /**
   * The built-in modules that have been imported, but not resolved.
   */
  readonly unresolvedModules = new Set<string>();

  /**
   * The name of the resolver hook to tap into.
   */
  readonly #source = 'described-resolve';

  /**
   * The options for the plugin.
   */
  readonly options: SnapsBuiltInResolverOptions;

  /**
   * The spinner to use for logging.
   */
  readonly #spinner?: Ora;

  constructor(
    options: SnapsBuiltInResolverOptions = {
      ignore: [],
    },
    spinner?: Ora,
  ) {
    this.options = options;
    this.#spinner = spinner;
  }

  /**
   * Apply the plugin to the Webpack resolver.
   *
   * @param resolver - The Webpack resolver.
   */
  apply(resolver: Resolver) {
    resolver
      .getHook(this.#source)
      .tapAsync(
        this.constructor.name,
        ({ module: isModule, request }, _, callback) => {
          if (!isModule || !request) {
            return callback();
          }

          const baseRequest = request.split('/')[0];
          if (
            isBuiltin(baseRequest) &&
            !this.options.ignore?.includes(baseRequest)
          ) {
            const fallback = resolver.options.fallback.find(
              ({ name }) => name === baseRequest,
            );

            if (fallback && !fallback.alias) {
              this.unresolvedModules.add(baseRequest);
            }
          }

          return callback();
        },
      );
  }
}

/**
 * The options for the {@link SnapsBundleWarningsPlugin}.
 */
export type SnapsBundleWarningsPluginOptions = {
  /**
   * The {@link SnapsBuiltInResolver} instance to use for detecting built-in
   * modules.
   */
  builtInResolver?: SnapsBuiltInResolver | false;

  /**
   * Whether to show warnings if built-in modules are used, but not provided by
   * Webpack's `fallback` configuration.
   */
  builtIns?: boolean;

  /**
   * Whether to show warnings if the `Buffer` global is used, but not provided
   * by Webpack's `DefinePlugin`.
   */
  buffer?: boolean;
};

/**
 * A plugin that logs a message when:
 *
 * - A built-in module is not resolved. The MetaMask Snaps CLI does not support
 * built-in modules by default, and this plugin is used to warn the user when
 * they try to import a built-in module, when no fallback is configured.
 * - A snap uses the `Buffer` global. The MetaMask Snaps CLI does not support
 * the `Buffer` global by default, and this plugin is used to warn the user when
 * they try to use the `Buffer` global.
 *
 * We use both a resolver and a plugin, because the resolver is used to detect
 * when a built-in module is imported, and the plugin is used to log a single
 * message when the compilation is complete. We can't do everything in a single
 * plugin, because the resolver doesn't have access to the compilation, and the
 * plugin doesn't have access to the resolver.
 */

export class SnapsBundleWarningsPlugin implements WebpackPluginInstance {
  /**
   * The options for the plugin.
   */
  readonly options: SnapsBundleWarningsPluginOptions;

  constructor(
    options: SnapsBundleWarningsPluginOptions = {
      buffer: true,
      builtIns: true,
    },
  ) {
    this.options = options;
  }

  /**
   * Apply the plugin to the Webpack compiler.
   *
   * @param compiler - The Webpack compiler.
   */
  apply(compiler: Compiler) {
    if (this.options.builtIns) {
      this.#checkBuiltIns(compiler);
    }

    if (this.options.buffer) {
      this.#checkBuffer(compiler);
    }
  }

  /**
   * Check if a built-in module is used, but not provided by Webpack's
   * `fallback` configuration.
   *
   * @param compiler - The Webpack compiler.
   */
  #checkBuiltIns(compiler: Compiler) {
    compiler.hooks.afterCompile.tap(this.constructor.name, (compilation) => {
      if (!this.options.builtInResolver) {
        return;
      }

      const { unresolvedModules } = this.options.builtInResolver;
      if (unresolvedModules.size === 0) {
        return;
      }

      const formattedModules = new Array(...unresolvedModules)
        .map((name) => `• ${name}`)
        .join('\n');

      const webpackError = new WebpackError(
        `The snap attempted to use one or more Node.js builtins, but no browser fallback has been provided. The MetaMask Snaps CLI does not support Node.js builtins by default. If you want to use this module, you must set ${bold(
          '`polyfills`',
        )} to ${bold(
          '`true`',
        )} or an object with the builtins to polyfill as the key and ${bold(
          '`true`',
        )} as the value. To disable this warning, set ${bold(
          '`stats.builtIns`',
        )} to ${bold(
          '`false`',
        )} in your snap config file, or add the module to the ${bold(
          '`stats.builtIns.ignore`',
        )} array.`,
      );

      webpackError.details = formattedModules;
      compilation.warnings.push(webpackError);
    });
  }

  /**
   * Check if the given instance is a `ProvidePlugin`. This is not guaranteed to
   * be accurate, but it's good enough for our purposes. If we were to use
   * `instanceof` instead, it might not work if multiple versions of Webpack are
   * installed.
   *
   * @param instance - The instance to check.
   * @returns Whether the instance is a `ProvidePlugin`, i.e., whether it's an
   * object with the name `ProvidePlugin` and a `definitions` property.
   */
  #isProvidePlugin(instance: unknown): instance is ProvidePlugin {
    return (
      isObject(instance) &&
      instance.constructor.name === 'ProvidePlugin' &&
      hasProperty(instance, 'definitions')
    );
  }

  /**
   * Check if the `Buffer` global is used, but not provided by Webpack's
   * `DefinePlugin`.
   *
   * @param compiler - The Webpack compiler.
   */
  #checkBuffer(compiler: Compiler) {
    const plugin = compiler.options.plugins?.find((instance) =>
      this.#isProvidePlugin(instance),
    ) as ProvidePlugin | undefined;

    // If the `ProvidePlugin` is configured to provide `Buffer`, then we don't
    // need to warn the user.
    if (plugin) {
      const { definitions } = plugin;
      if (definitions.Buffer) {
        return;
      }
    }

    compiler.hooks.compilation.tap(this.constructor.name, (compilation) => {
      compilation.hooks.afterProcessAssets.tap(
        this.constructor.name,
        (assets) => {
          // Check if assets use `Buffer`.
          const bufferAssets = Object.entries(assets)
            .filter(([name]) => name.endsWith('.js'))
            .filter(([, asset]) => asset.source().includes('Buffer'));

          if (bufferAssets.length === 0) {
            return;
          }

          compilation.warnings.push(
            new WebpackError(
              `The snap attempted to use the Node.js Buffer global, which is not supported in the MetaMask Snaps CLI by default. To use the Buffer global, you must polyfill Buffer by setting ${bold(
                '`buffer`',
              )} to ${bold('`true`')} in the ${bold(
                '`polyfills`',
              )} config object in your snap config. To disable this warning, set ${bold(
                '`stats.buffer`',
              )} to ${bold('`false`')} in your snap config file.`,
            ),
          );
        },
      );
    });
  }
}
