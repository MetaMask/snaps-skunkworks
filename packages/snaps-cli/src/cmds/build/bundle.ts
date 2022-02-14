import browserify from 'browserify';
import { YargsArgs } from '../../types/yargs';
import { TranspilationModes } from '../../builders';
import {
  createBundleStream,
  closeBundleStream,
  processDependencies,
} from './bundleUtils';

// We need to statically import all Browserify transforms and all Babel presets
// and plugins, and calling `require` is the sanest way to do that.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, node/global-require */

/**
 * Builds a Snap bundle JSON file from its JavaScript source.
 *
 * @param src - The source file path.
 * @param dest - The destination file path.
 * @param argv - arguments as an object generated by yargs.
 * @param argv.sourceMaps - Whether to output sourcemaps.
 * @param argv.stripComments - Whether to remove comments from code.
 * @param argv.transpilationMode - The Babel transpilation mode.
 */
export function bundle(
  src: string,
  dest: string,
  argv: YargsArgs,
): Promise<boolean> {
  const { sourceMaps: debug, transpilationMode } = argv;
  const babelifyOptions = processDependencies(argv as any);
  return new Promise((resolve, _reject) => {
    const bundleStream = createBundleStream(dest);
    const bundler = browserify(src, { debug });
    if (transpilationMode !== TranspilationModes.none) {
      bundler.transform(require('babelify'), {
        global: transpilationMode === TranspilationModes.localAndDeps,
        presets: [
          [
            require('@babel/preset-env'),
            {
              targets: {
                browsers: ['chrome >= 66', 'firefox >= 68'],
              },
            },
          ],
        ],
        plugins: [
          require('@babel/plugin-transform-runtime'),
          require('@babel/plugin-proposal-class-properties'),
          require('@babel/plugin-proposal-object-rest-spread'),
          require('@babel/plugin-proposal-optional-chaining'),
          require('@babel/plugin-proposal-nullish-coalescing-operator'),
        ],
        ...(babelifyOptions as any),
      });
    }

    bundler.bundle(
      async (bundleError, bundleBuffer: Buffer) =>
        await closeBundleStream({
          bundleError,
          bundleBuffer,
          bundleStream,
          src,
          dest,
          resolve,
          argv,
        }),
    );
  });
}
