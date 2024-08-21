import browserify from 'browserify';
import { Readable } from 'readable-stream';
import type { LoaderDefinitionFunction } from 'webpack';

import { TranspilationModes } from '../../builders';
import type { LegacyOptions } from '../../config';
import { processDependencies } from '../../utils';
import { getBrowserslistTargets } from '../utils';

/**
 * A Browserify loader for Webpack. This exists for backwards compatibility with
 * the legacy configuration format, in order to support the `bundlerCustomizer`
 * function.
 *
 * When this loader is used, the input file will be processed by Browserify, and
 * written to disk by Webpack. Most processing will be handled by Browserify, so
 * there are no benefits like tree-shaking.
 *
 * @param content - The input file contents as a string.
 * @param sourceMap - The source map of the input file.
 * @returns The Browserify loader.
 */
const loader: LoaderDefinitionFunction<LegacyOptions> = async function (
  content,
  sourceMap,
) {
  const config = this.getOptions();

  const { transpilationMode } = config;

  const bundler = browserify({
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    debug: Boolean(sourceMap),
    standalone: '<snap>',
  });

  if (transpilationMode !== TranspilationModes.None) {
    const babelifyOptions = processDependencies(config);

    // We need to statically import all Browserify transforms, and all Babel
    // presets and plugins, and calling `require` is the sanest way to do that.
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, n/global-require */
    bundler.transform(require('babelify'), {
      global: transpilationMode === TranspilationModes.LocalAndDeps,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      presets: [
        require('@babel/preset-typescript'),
        [
          require('@babel/preset-env'),
          {
            targets: {
              browsers: await getBrowserslistTargets(),
            },
          },
        ],
      ],
      plugins: [
        require('@babel/plugin-transform-runtime'),
        require('@babel/plugin-transform-class-properties'),
        require('@babel/plugin-transform-private-methods'),
        require('@babel/plugin-transform-class-static-block'),
        require('@babel/plugin-transform-private-property-in-object'),
      ],
      ...(babelifyOptions as any),
    });
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, n/global-require */
  }

  config.bundlerCustomizer?.(bundler);

  // Browserify doesn't accept a string as an entry point, so we need to convert
  // it to a stream.
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  bundler.add(stream, {
    file: this.resourcePath,
  });

  return new Promise<Buffer>((resolve, reject) => {
    bundler.bundle((bundleError, buffer: Buffer) => {
      if (bundleError) {
        reject(bundleError);
        return;
      }

      // Browserify inlines the source map, so we just pass the output buffer back
      // to Webpack.
      resolve(buffer);
    });
  });
};

export default loader;
