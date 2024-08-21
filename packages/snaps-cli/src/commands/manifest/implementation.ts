import { checkManifest, indent } from '@metamask/snaps-utils/node';
import { assert } from '@metamask/utils';
import { red, yellow, green } from 'chalk';
import type { Ora } from 'ora';
import { dirname } from 'path';

import { error, info, warn } from '../../utils';

/**
 * Check the snap manifest file at the given path. If `write` is `true`, the
 * manifest will be written to disk if it is invalid. If `write` is `false`,
 * the manifest will not be written to disk, and the function will log any
 * errors and warnings to the console.
 *
 * @param path - The path to the manifest file.
 * @param write - Whether to write the manifest to disk if it is invalid.
 * @param spinner - An optional spinner to use for logging.
 * @returns Whether the manifest is valid.
 */
export async function manifest(
  path: string,
  write: boolean,
  spinner?: Ora,
): Promise<boolean> {
  const { reports, updated } = await checkManifest(dirname(path), {
    updateAndWriteManifest: write,
  });

  const errors = [];
  const fixed = [];
  const warnings = [];

  for (const report of reports) {
    if (report.severity === 'error' && !report.wasFixed) {
      errors.push(indent(red(`• ${report.message}`)));
    } else if (report.wasFixed) {
      fixed.push(indent(yellow(`• ${report.message}`) + green(' (fixed)')));
    } else {
      assert(report.severity === 'warning');
      warnings.push(indent(yellow(`• ${report.message}`)));
    }
  }

  if (errors.length > 0) {
    const formattedErrors = errors.join('\n');
    let message = `The snap manifest file is invalid.\n\n${formattedErrors}`;
    if (!write) {
      message +=
        '\n\nRun the command with the `--fix` flag to attempt to fix the manifest.';
    }

    error(message, spinner);
  }

  if (write && updated) {
    const formattedFixed = fixed.join('\n');
    info(
      `The snap manifest file has been updated.\n\n${formattedFixed}`,
      spinner,
    );
  }

  if (warnings.length > 0) {
    const formattedWarnings = warnings.join('\n');

    warn(
      `The snap manifest file has warnings.\n\n${formattedWarnings}`,
      spinner,
    );
  }

  if (errors.length > 0) {
    spinner?.stop();
    process.exitCode = 1;
    return false;
  }

  return true;
}
