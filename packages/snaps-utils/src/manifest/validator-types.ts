import type { SnapManifest } from './validation';
import type { Promisable } from '../promise';
import type { SnapFiles, UnvalidatedSnapFiles } from '../types';

// Eslint uses patch based fixing, but it's too complex for our needs.
// https://eslint.org/docs/latest/extend/custom-rules#applying-fixes
export type ValidatorFix = (files: {
  manifest: SnapManifest;
}) => Promisable<{ manifest: SnapManifest }>;

export type ValidatorSeverity = 'error' | 'warning';

export type ValidatorContext = {
  report: (message: string, fix?: ValidatorFix) => void;
};

export type ValidatorReport = {
  severity: ValidatorSeverity;
  message: string;
  fix?: ValidatorFix;
};

export type ValidatorMeta = {
  severity: ValidatorSeverity;

  /**
   * 1. Run the validator on unverified files to ensure that the files are structurally sound.
   *
   * @param files - Files to be verified
   * @param context - Validator context to report errors
   */
  structureCheck?: (
    files: UnvalidatedSnapFiles,
    context: ValidatorContext,
  ) => void | Promise<void>;

  /**
   * 2. Run the validator after the files were checked to be structurally sound.
   *
   * @param files - Files to be verified
   * @param context - Validator context to report errors
   */
  semanticCheck?: (
    files: SnapFiles,
    context: ValidatorContext,
  ) => void | Promise<void>;
};
