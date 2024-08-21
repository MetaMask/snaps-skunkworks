import { isFile } from '@metamask/snaps-utils/node';
import { resolve as pathResolve } from 'path';

import { build } from './implementation';
import type { ProcessedConfig, ProcessedWebpackConfig } from '../../config';
import { CommandError } from '../../errors';
import type { Steps } from '../../utils';
import { executeSteps, info } from '../../utils';
import { evaluate } from '../eval';

type BuildContext = {
  config: ProcessedWebpackConfig;
};

const steps: Steps<BuildContext> = [
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
    name: 'Building the snap bundle.',
    task: async ({ config, spinner }) => {
      // We don't evaluate the bundle here, because it's done in a separate
      // step.
      return await build(config, { evaluate: false, spinner });
    },
  },
  {
    name: 'Evaluating the snap bundle.',
    condition: ({ config }) => config.evaluate,
    task: async ({ config, spinner }) => {
      const path = pathResolve(
        process.cwd(),
        config.output.path,
        config.output.filename,
      );

      await evaluate(path);

      info(`Snap bundle evaluated successfully.`, spinner);
    },
  },
] as const;

/**
 * Build all files in the given source directory to the given destination
 * directory.
 *
 * This creates the destination directory if it doesn't exist.
 *
 * @param config - The config object.
 * @returns The result of the build.
 */
export async function buildHandler(config: ProcessedConfig): Promise<void> {
  return await executeSteps(steps, {
    config,
  });
}
