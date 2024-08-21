import { isFile } from '@metamask/snaps-utils/node';
import { resolve } from 'path';

import { evaluate } from './implementation';
import type { ProcessedConfig } from '../../config';
import { CommandError } from '../../errors';
import type { Steps } from '../../utils';
import { executeSteps, getRelativePath } from '../../utils';

export type EvalOptions = {
  input?: string;
};

export type EvalContext = Required<EvalOptions>;

const steps: Steps<EvalContext> = [
  {
    name: 'Checking the input file.',
    task: async ({ input }) => {
      if (!(await isFile(input))) {
        const relativePath = getRelativePath(input);
        throw new CommandError(
          `Input file not found: "${relativePath}". Make sure that the "input" field in your snap config or the specified input file is correct.`,
        );
      }
    },
  },
  {
    name: 'Evaluating the snap bundle.',
    task: async ({ input, spinner }) => {
      await evaluate(input);
      spinner.succeed('Snap bundle evaluated successfully.');
    },
  },
];

/**
 * Returns the path to the bundle, based on the config and options.
 *
 * - If `options.input` is specified, it is used as the bundle path.
 * - Otherwise, the bundle path is resolved from the config's output path and
 * filename.
 *
 * @param config - The processed config object.
 * @param options - The eval options.
 * @returns The path to the bundle.
 */
function getBundlePath(config: ProcessedConfig, options: EvalOptions): string {
  if (options.input) {
    return resolve(process.cwd(), options.input);
  }

  return resolve(config.output.path, config.output.filename);
}

/**
 * Runs the snap in a worker, to ensure SES compatibility.
 *
 * @param config - The processed config object.
 * @param options - The eval options.
 * @returns A promise that resolves once the eval has finished.
 * @throws If the eval failed.
 */
export async function evaluateHandler(
  config: ProcessedConfig,
  options: EvalOptions = {},
): Promise<void> {
  const input = getBundlePath(config, options);
  await executeSteps(steps, { input });
}
