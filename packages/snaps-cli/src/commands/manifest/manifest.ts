import { isFile } from '@metamask/snaps-utils/node';

import { manifest } from './implementation';
import type { ProcessedConfig } from '../../config';
import { CommandError } from '../../errors';
import type { Steps } from '../../utils';
import { executeSteps } from '../../utils';

type ManifestOptions = {
  fix?: boolean;
};

type ManifestContext = {
  input: string;
  config: ProcessedConfig;
  options: ManifestOptions;
};

const steps: Steps<ManifestContext> = [
  {
    name: 'Checking the input file.',
    task: async ({ input }) => {
      if (!(await isFile(input))) {
        throw new CommandError(
          `Manifest file not found: "${input}". Make sure that the \`snap.manifest.json\` file exists.`,
        );
      }
    },
  },
  {
    name: 'Validating the snap manifest.',
    task: async ({ input, config, options, spinner }) => {
      const write = getWriteManifest(config, options);
      const valid = await manifest(input, write, spinner);

      if (valid) {
        spinner.succeed('The snap manifest file is valid.');
      }
    },
  },
];

/**
 * Get whether to write the manifest to disk.
 *
 * @param config - The config object.
 * @param options - The options object.
 * @returns Whether to write the manifest to disk.
 */
function getWriteManifest(config: ProcessedConfig, options: ManifestOptions) {
  if (typeof options.fix === 'boolean') {
    return options.fix;
  }

  return config.legacy?.writeManifest ?? false;
}

/**
 * Validates a snap.manifest.json file. Attempts to fix the manifest and write
 * the fixed version to disk if `writeManifest` is true. Throws if validation
 * fails.
 *
 * @param config - The config object.
 * @param options - The options object.
 */
export async function manifestHandler(
  config: ProcessedConfig,
  options: ManifestOptions,
) {
  await executeSteps(steps, {
    input: config.manifest.path,
    config,
    options,
  });
}
