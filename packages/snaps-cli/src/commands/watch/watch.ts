import { isFile } from '@metamask/snaps-utils/node';

import type { ProcessedConfig, ProcessedWebpackConfig } from '../../config';
import { CommandError } from '../../errors';
import type { Steps } from '../../utils';
import { executeSteps, info } from '../../utils';
import { getServer } from '../../webpack';
import { watch } from './implementation';

type WatchOptions = {
  /**
   * The port to listen on.
   */
  port?: number;

  /**
   * The host to listen on.
   */
  host?: string;
};

type WatchContext = {
  config: ProcessedWebpackConfig;
  options: WatchOptions;
};

const steps: Steps<WatchContext> = [
  {
    name: 'Checking the input file.',
    task: async ({ config }) => {
      const { input } = config;

      if (!(await isFile(input))) {
        throw new CommandError(
          `Input file not found: "${input}". Make sure that the "input" field in your snap config is correct.`,
        );
      }
    },
  },
  {
    name: 'Starting the development server.',
    condition: ({ config }) => config.server.enabled,
    task: async ({ config, options, spinner }) => {
      const server = getServer(config);
      const { port, host } = await server.listen(
        options.port ?? config.server.port,
        options.host ?? config.server.host,
      );

      info(`The server is listening on http://${host}:${port}.`, spinner);
    },
  },
  {
    name: 'Building the snap bundle.',
    task: async ({ config, spinner }) => {
      await watch(config, { spinner });
    },
  },
];

/**
 * Watch a directory and its subdirectories for changes, and build when files
 * are added or changed.
 *
 * Ignores 'node_modules' and dotfiles.
 * Creates destination directory if it doesn't exist.
 *
 * @param config - The config object.
 * @param options - The options object.
 */
export async function watchHandler(
  config: ProcessedConfig,
  options: WatchOptions,
): Promise<void> {
  await executeSteps(steps, { config, options });
}
