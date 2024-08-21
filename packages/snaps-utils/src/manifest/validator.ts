import { assert } from '@metamask/utils';

import type {
  ValidatorContext,
  ValidatorFix,
  ValidatorMeta,
  ValidatorReport,
  ValidatorSeverity,
} from './validator-types';
import * as defaultValidators from './validators';
import type { SnapFiles, UnvalidatedSnapFiles } from '../types';

export type ValidatorResults = {
  files?: SnapFiles;
  reports: ValidatorReport[];
};

class Context implements ValidatorContext {
  reports: ValidatorReport[] = [];

  #nextSeverity?: ValidatorSeverity = undefined;

  report(message: string, fix?: ValidatorFix): void {
    assert(this.#nextSeverity !== undefined);
    this.reports.push({
      severity: this.#nextSeverity,
      message,
      fix,
    });
  }

  prepareForValidator(settings: { severity: ValidatorSeverity }) {
    this.#nextSeverity = settings.severity;
  }

  get hasErrors() {
    return this.reports.some((report) => report.severity === 'error');
  }
}

/**
 * Verify that snap files are completely valid.
 * First it runs validators on unparsed files to check structure.
 * Secondly it runs validators on parsed files to check semantics.
 *
 * @param files - All files required to run a snap.
 * @param rules - Validators to run.
 * @returns The results of the validation run.
 */
// TODO(ritave): snap.manifest.json and package.json should check
//               json parsing as well instead of assuming it's
//               already parsed
export async function runValidators(
  files: UnvalidatedSnapFiles,
  rules: ValidatorMeta[] = Object.values(defaultValidators),
): Promise<ValidatorResults> {
  const context = new Context();

  for (const rule of rules) {
    context.prepareForValidator({
      severity: rule.severity,
    });
    await rule.structureCheck?.(files, context);
  }
  if (context.hasErrors) {
    return {
      reports: context.reports,
    };
  }

  for (const rule of rules) {
    context.prepareForValidator({
      severity: rule.severity,
    });
    await rule.semanticCheck?.(files as SnapFiles, context);
  }
  return {
    files: files as SnapFiles,
    reports: context.reports,
  };
}

/**
 * Get whether any reports has pending fixes.
 *
 * @param results - Results of the validation run.
 * @returns Whether there are fixes pending.
 */
export function hasFixes(results: ValidatorResults): boolean {
  return results.reports.some((report) => report.fix);
}
