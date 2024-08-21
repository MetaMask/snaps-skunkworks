import { evalBundle, SnapEvalError, indent } from '@metamask/snaps-utils/node';
import { red } from 'chalk';

import { CommandError } from '../../errors';

/**
 * Evaluate the given bundle in the SES environment. This is a wrapper around
 * {@link evalBundle} that throws a {@link CommandError} if the bundle cannot be
 * evaluated.
 *
 * @param path - The path to the bundle.
 * @throws If the bundle cannot be evaluated.
 * @returns The status of the eval.
 */
export async function evaluate(path: string) {
  try {
    return await evalBundle(path);
  } catch (evalError) {
    if (evalError instanceof SnapEvalError) {
      throw new CommandError(
        `Failed to evaluate snap bundle in SES. This is likely due to an incompatibility with the SES environment in your snap.\nReceived the following error from the SES environment:\n\n${indent(
          red(evalError.output.stderr),
          2,
        )}`,
      );
    }

    // If the error is not a `SnapEvalError`, we don't know what it is, so
    // we just throw it.
    throw evalError;
  }
}
