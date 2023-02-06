import {
  Caveat,
  SubjectPermissions,
  PermissionConstraint,
} from '@metamask/permission-controller';
import { BlockReason } from '@metamask/snaps-registry';
import { assert, Json, SemVerVersion } from '@metamask/utils';
import { sha256 } from '@noble/hashes/sha256';
import { base64 } from '@scure/base';
import { SerializedEthereumRpcError } from 'eth-rpc-errors/dist/classes';
import {
  empty,
  enums,
  intersection,
  literal,
  refine,
  string,
  Struct,
  validate,
} from 'superstruct';
import validateNPMPackage from 'validate-npm-package-name';

import { SnapCaveatType } from './caveats';
import { SnapManifest, SnapPermissions } from './manifest/validation';
import {
  SnapId,
  SnapIdPrefixes,
  SnapValidationFailureReason,
  uri,
} from './types';

// This RegEx matches valid npm package names (with some exceptions) and space-
// separated alphanumerical words, optionally with dashes and underscores.
// The RegEx consists of two parts. The first part matches space-separated
// words. It is based on the following Stackoverflow answer:
// https://stackoverflow.com/a/34974982
// The second part, after the pipe operator, is the same RegEx used for the
// `name` field of the official package.json JSON Schema, except that we allow
// mixed-case letters. It was originally copied from:
// https://github.com/SchemaStore/schemastore/blob/81a16897c1dabfd98c72242a5fd62eb080ff76d8/src/schemas/json/package.json#L132-L138
export const PROPOSED_NAME_REGEX =
  /^(?:[A-Za-z0-9-_]+( [A-Za-z0-9-_]+)*)|(?:(?:@[A-Za-z0-9-*~][A-Za-z0-9-*._~]*\/)?[A-Za-z0-9-~][A-Za-z0-9-._~]*)$/u;

/**
 * wallet_enable / wallet_installSnaps permission typing.
 *
 * @deprecated This type is confusing and not descriptive, people confused it with typing initialPermissions, remove when removing wallet_enable.
 */
export type RequestedSnapPermissions = {
  [permission: string]: Record<string, Json>;
};

export enum SnapStatus {
  Installing = 'installing',
  Updating = 'updating',
  Running = 'running',
  Stopped = 'stopped',
  Crashed = 'crashed',
}

export enum SnapStatusEvents {
  Start = 'START',
  Stop = 'STOP',
  Crash = 'CRASH',
  Update = 'UPDATE',
}

export type StatusContext = { snapId: string };
export type StatusEvents = { type: SnapStatusEvents };
export type StatusStates = {
  value: SnapStatus;
  context: StatusContext;
};
export type Status = StatusStates['value'];

export type VersionHistory = {
  origin: string;
  version: string;
  // Unix timestamp
  date: number;
};

export type PersistedSnap = Snap & {
  /**
   * The source code of the Snap.
   */
  sourceCode: string;
};

/**
 * A Snap as it exists in {@link SnapController} state.
 */
export type Snap = {
  /**
   * Whether the Snap is enabled, which determines if it can be started.
   */
  enabled: boolean;

  /**
   * The ID of the Snap.
   */
  id: SnapId;

  /**
   * The initial permissions of the Snap, which will be requested when it is
   * installed.
   */
  initialPermissions: SnapPermissions;

  /**
   * The Snap's manifest file.
   */
  manifest: SnapManifest;

  /**
   * Whether the Snap is blocked.
   */
  blocked: boolean;

  /**
   * Information detailing why the snap is blocked.
   */
  blockInformation?: BlockReason;

  /**
   * The current status of the Snap, e.g. whether it's running or stopped.
   */
  status: Status;

  /**
   * The version of the Snap.
   */
  version: SemVerVersion;

  /**
   * The version history of the Snap.
   * Can be used to derive when the Snap was installed, when it was updated to a certain version and who requested the change.
   */
  versionHistory: VersionHistory[];
};

export type TruncatedSnapFields =
  | 'id'
  | 'initialPermissions'
  | 'version'
  | 'enabled'
  | 'blocked';

/**
 * A {@link Snap} object with the fields that are relevant to an external
 * caller.
 */
export type TruncatedSnap = Pick<Snap, TruncatedSnapFields>;

export type ProcessSnapResult =
  | TruncatedSnap
  | { error: SerializedEthereumRpcError };

export type InstallSnapsResult = Record<SnapId, ProcessSnapResult>;

/**
 * An error indicating that a Snap validation failure is programmatically
 * fixable during development.
 */
export class ProgrammaticallyFixableSnapError extends Error {
  reason: SnapValidationFailureReason;

  constructor(message: string, reason: SnapValidationFailureReason) {
    super(message);
    this.reason = reason;
  }
}

/**
 * Calculates the Base64-encoded SHA-256 digest of a Snap source code string.
 *
 * @param sourceCode - The UTF-8 string source code of a Snap.
 * @returns The Base64-encoded SHA-256 digest of the source code.
 */
export function getSnapSourceShasum(sourceCode: string): string {
  return base64.encode(sha256(sourceCode));
}

export type ValidatedSnapId = `local:${string}` | `npm:${string}`;

/**
 * Checks whether the `source.shasum` property of a Snap manifest matches the
 * shasum of a snap source code string.
 *
 * @param manifest - The manifest whose shasum to validate.
 * @param sourceCode - The source code of the snap.
 * @param errorMessage - The error message to throw if validation fails.
 */
export function validateSnapShasum(
  manifest: SnapManifest,
  sourceCode: string,
  errorMessage = 'Invalid Snap manifest: manifest shasum does not match computed shasum.',
): void {
  if (manifest.source.shasum !== getSnapSourceShasum(sourceCode)) {
    throw new ProgrammaticallyFixableSnapError(
      errorMessage,
      SnapValidationFailureReason.ShasumMismatch,
    );
  }
}

export const LOCALHOST_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'] as const;

const LocalSnapIdSubUrlStruct = uri({
  protocol: enums(['http:', 'https:']),
  hostname: enums(LOCALHOST_HOSTNAMES),
  hash: empty(string()),
  search: empty(string()),
});
export const LocalSnapIdStruct = refine(string(), 'local Snap Id', (value) => {
  if (!value.startsWith(SnapIdPrefixes.local)) {
    return `Expected local Snap ID, got "${value}".`;
  }

  const [error] = validate(
    value.slice(SnapIdPrefixes.local.length),
    LocalSnapIdSubUrlStruct,
  );
  return error ?? true;
});
export const NpmSnapIdStruct = intersection([
  string(),
  uri({
    protocol: literal(SnapIdPrefixes.npm),
    pathname: refine(string(), 'package name', function* (value) {
      const normalized = value.startsWith('/') ? value.slice(1) : value;
      const { errors, validForNewPackages, warnings } =
        validateNPMPackage(normalized);
      if (!validForNewPackages) {
        if (errors === undefined) {
          assert(warnings !== undefined);
          yield* warnings;
        } else {
          yield* errors;
        }
      }
      return true;
    }),
    search: empty(string()),
    hash: empty(string()),
  }),
]) as unknown as Struct<string, null>;

export const HttpSnapIdStruct = intersection([
  string(),
  uri({
    protocol: enums(['http:', 'https:']),
    search: empty(string()),
    hash: empty(string()),
  }),
]) as unknown as Struct<string, null>;

/**
 * Extracts the snap prefix from a snap ID.
 *
 * @param snapId - The snap ID to extract the prefix from.
 * @returns The snap prefix from a snap id, e.g. `npm:`.
 */
export function getSnapPrefix(snapId: string): SnapIdPrefixes {
  const prefix = Object.values(SnapIdPrefixes).find((possiblePrefix) =>
    snapId.startsWith(possiblePrefix),
  );
  if (prefix !== undefined) {
    return prefix;
  }
  throw new Error(`Invalid or no prefix found for "${snapId}"`);
}

/**
 * Asserts the provided object is a snapId with a supported prefix.
 *
 * @param snapId - The object to validate.
 * @throws {@link Error}. If the validation fails.
 */
export function validateSnapId(
  snapId: unknown,
): asserts snapId is ValidatedSnapId {
  if (!snapId || typeof snapId !== 'string') {
    throw new Error(`Invalid snap id. Not a string.`);
  }

  for (const prefix of Object.values(SnapIdPrefixes)) {
    if (snapId.startsWith(prefix) && snapId.replace(prefix, '').length > 0) {
      return;
    }
  }

  throw new Error(`Invalid snap id. Unknown prefix. Received: "${snapId}".`);
}

/**
 * Typeguard to ensure a chainId follows the CAIP-2 standard.
 *
 * @param chainId - The chainId being tested.
 * @returns `true` if the value is a valid CAIP chain id, and `false` otherwise.
 */
export function isCaipChainId(chainId: unknown): chainId is string {
  return (
    typeof chainId === 'string' &&
    /^(?<namespace>[-a-z0-9]{3,8}):(?<reference>[-a-zA-Z0-9]{1,32})$/u.test(
      chainId,
    )
  );
}

/**
 * Utility function to check if an origin has permission (and caveat) for a particular snap.
 *
 * @param permissions - An origin's permissions object.
 * @param snapId - The id of the snap.
 * @returns A boolean based on if an origin has the specified snap.
 */
export function isSnapPermitted(
  permissions: SubjectPermissions<PermissionConstraint>,
  snapId: SnapId,
) {
  return Boolean(
    (
      (
        (permissions?.wallet_snap?.caveats?.find(
          (caveat) => caveat.type === SnapCaveatType.SnapIds,
        ) ?? {}) as Caveat<string, Json>
      ).value as Record<string, unknown>
    )?.[snapId],
  );
}
