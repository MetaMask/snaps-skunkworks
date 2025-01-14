import { assert } from '@metamask/utils';
import { basename } from 'path';
import type { Watching } from 'webpack';

import type { ProcessedWebpackConfig } from '../../config';
import type { WebpackOptions } from '../../webpack';
import { getCompiler } from '../../webpack';

/**
 * Build the snap bundle and watch for changes. This uses Webpack to build the
 * bundle.
 *
 * @param config - The config object.
 * @param options - The Webpack options.
 * @returns A promise that resolves when the bundle is built for the first time.
 * The promise resolves with a Webpack watching instance that can be used to
 * close the watcher.
 */
export async function watch(
  config: ProcessedWebpackConfig,
  options?: WebpackOptions,
) {
  const compiler = await getCompiler(config, {
    evaluate: config.evaluate,
    watch: true,
    spinner: options?.spinner,
  });

  return new Promise<Watching>((resolve, reject) => {
    compiler.watch(
      {
        ignored: [
          '**/node_modules/**/*',
          `**/${basename(config.output.path)}/**/*`,
        ],
      },
      (watchError) => {
        if (watchError) {
          reject(watchError);
          return;
        }

        assert(
          compiler.watching,
          'Expected `compiler.watching` to be defined.',
        );

        resolve(compiler.watching);
      },
    );
  });
}
