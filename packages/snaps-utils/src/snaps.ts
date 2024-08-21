import type {
  Caveat,
  SubjectPermissions,
  PermissionConstraint,
} from '@metamask/permission-controller';
import type { BlockReason } from '@metamask/snaps-registry';
import type { SnapId, Snap as TruncatedSnap } from '@metamask/snaps-sdk';
import type { Struct } from '@metamask/superstruct';
import {
  empty,
  enums,
  intersection,
  literal,
  pattern,
  refine,
  string,
  union,
  validate,
} from '@metamask/superstruct';
import type { Json } from '@metamask/utils';
import { assert, isObject, assertStruct } from '@metamask/utils';
import { base64 } from '@scure/base';
import stableStringify from 'fast-json-stable-stringify';
import validateNPMPackage from 'validate-npm-package-name';

import { SnapCaveatType } from './caveats';
import { checksumFiles } from './checksum';
import type { LocalizationFile } from './localization';
import type {
  InitialConnections,
  SnapManifest,
  SnapPermissions,
} from './manifest/validation';
import type { FetchedSnapFiles, SnapsPermissionRequest } from './types';
import { SnapIdPrefixes, uri } from './types';
import type { VirtualFile } from './virtual-file';

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

export type StatusContext = { snapId: SnapId };
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

export type SnapAuxilaryFile = {
  path: string;
  // Value here should be stored as base64
  value: string;
};

export type PersistedSnap = Snap;

/**
 * A Snap as it exists in {@link SnapController} state.
 */
export type Snap = TruncatedSnap & {
  /**
   * The initial connections of the Snap, optional, requested on installation.
   */
  initialConnections?: InitialConnections;
  /**
   * The initial permissions of the Snap, which will be requested when it is
   * installed.
   */
  initialPermissions: SnapPermissions;

  /**
   * The source code of the Snap.
   */
  sourceCode: string;

  /**
   * The Snap's manifest file.
   */
  manifest: SnapManifest;

  /**
   * Information detailing why the snap is blocked.
   */
  blockInformation?: BlockReason;

  /**
   * The current status of the Snap, e.g. whether it's running or stopped.
   */
  status: Status;

  /**
   * The version history of the Snap.
   * Can be used to derive when the Snap was installed, when it was updated to a certain version and who requested the change.
   */
  versionHistory: VersionHistory[];

  /**
   * Static auxiliary files that can be loaded at runtime.
   */
  auxiliaryFiles?: SnapAuxilaryFile[];

  /**
   * Localization files which are used to translate the manifest.
   */
  localizationFiles?: LocalizationFile[];

  /**
   * Flag to signal whether this snap was preinstalled or not.
   *
   * A lack of specifying this option will be deemed as not preinstalled.
   */
  preinstalled?: boolean;

  /**
   * Flag to signal whether this snap is removable or not.
   *
   * A lack of specifying this option will be deemed as removable.
   */
  removable?: boolean;

  /**
   * Flag to signal whether this snap should be hidden from the user or not.
   */
  hidden?: boolean;
};

export type TruncatedSnapFields =
  | 'id'
  | 'initialPermissions'
  | 'version'
  | 'enabled'
  | 'blocked';

/**
 * Gets a checksummable manifest by removing the shasum property and reserializing the JSON using a deterministic algorithm.
 *
 * @param manifest - The manifest itself.
 * @returns A virtual file containing the checksummable manifest.
 */
function getChecksummableManifest(
  manifest: VirtualFile<SnapManifest>,
): VirtualFile {
  const manifestCopy = manifest.clone() as VirtualFile<any>;
  delete manifestCopy.result.source.shasum;

  // We use fast-json-stable-stringify to deterministically serialize the JSON
  // This is required before checksumming so we get reproducible checksums across platforms etc
  manifestCopy.value = stableStringify(manifestCopy.result);
  return manifestCopy;
}

/**
 * Calculates the Base64-encoded SHA-256 digest of all required Snap files.
 *
 * @param files - All required Snap files to be included in the checksum.
 * @returns The Base64-encoded SHA-256 digest of the source code.
 */
export async function getSnapChecksum(
  files: FetchedSnapFiles,
): Promise<string> {
  const { manifest, sourceCode, svgIcon, auxiliaryFiles, localizationFiles } =
    files;

  const all = [
    getChecksummableManifest(manifest),
    sourceCode,
    svgIcon,
    ...auxiliaryFiles,
    ...localizationFiles,
  ].filter((file) => file !== undefined);

  return base64.encode(await checksumFiles(all as VirtualFile[]));
}

/**
 * Checks whether the `source.shasum` property of a Snap manifest matches the
 * shasum of the snap.
 *
 * @param files - All required Snap files to be included in the checksum.
 * @param errorMessage - The error message to throw if validation fails.
 */
export async function validateSnapShasum(
  files: FetchedSnapFiles,
  errorMessage = 'Invalid Snap manifest: manifest shasum does not match computed shasum.',
): Promise<void> {
  if (files.manifest.result.source.shasum !== (await getSnapChecksum(files))) {
    throw new Error(errorMessage);
  }
}

export const LOCALHOST_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]'] as const;

// Require snap ids to only consist of printable ASCII characters
export const BaseSnapIdStruct = pattern(string(), /^[\x21-\x7E]*$/u);

const LocalSnapIdSubUrlStruct = uri({
  protocol: enums(['http:', 'https:']),
  hostname: enums(LOCALHOST_HOSTNAMES),
  hash: empty(string()),
  search: empty(string()),
});

export const LocalSnapIdStruct = refine(
  BaseSnapIdStruct,
  'local Snap Id',
  (value) => {
    if (!value.startsWith(SnapIdPrefixes.local)) {
      return `Expected local snap ID, got "${value}".`;
    }

    const [error] = validate(
      value.slice(SnapIdPrefixes.local.length),
      LocalSnapIdSubUrlStruct,
    );
    return error ?? true;
  },
);
export const NpmSnapIdStruct = intersection([
  BaseSnapIdStruct,
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
  BaseSnapIdStruct,
  uri({
    protocol: enums(['http:', 'https:']),
    search: empty(string()),
    hash: empty(string()),
  }),
]) as unknown as Struct<string, null>;

export const SnapIdStruct = union([NpmSnapIdStruct, LocalSnapIdStruct]);

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
 * Strips snap prefix from a full snap ID.
 *
 * @param snapId - The snap ID to strip.
 * @returns The stripped snap ID.
 */
export function stripSnapPrefix(snapId: string): string {
  return snapId.replace(getSnapPrefix(snapId), '');
}

/**
 * Assert that the given value is a valid snap ID.
 *
 * @param value - The value to check.
 * @throws If the value is not a valid snap ID.
 */
export function assertIsValidSnapId(value: unknown): asserts value is SnapId {
  assertStruct(value, SnapIdStruct, 'Invalid snap ID');
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
          (caveat) => caveat.type === SnapCaveatType.SnapIds,
        ) ?? {}) as Caveat<string, Json>
      ).value as Record<string, unknown>
    )?.[snapId],
  );
}

/**
 * Checks whether the passed in requestedPermissions is a valid
 * permission request for a `wallet_snap` permission.
 *
 * @param requestedPermissions - The requested permissions.
 * @throws If the criteria is not met.
 */
export function verifyRequestedSnapPermissions(
  requestedPermissions: unknown,
): asserts requestedPermissions is SnapsPermissionRequest {
  assert(
    isObject(requestedPermissions),
    'Requested permissions must be an object.',
  );

  const { wallet_snap: walletSnapPermission } = requestedPermissions;

  assert(
    isObject(walletSnapPermission),
    'wallet_snap is missing from the requested permissions.',
  );

  const { caveats } = walletSnapPermission;

  assert(
    Array.isArray(caveats) && caveats.length === 1,
    'wallet_snap must have a caveat property with a single-item array value.',
  );

  const [caveat] = caveats;

  assert(
    isObject(caveat) &&
      caveat.type === SnapCaveatType.SnapIds &&
      isObject(caveat.value),
    `The requested permissions do not have a valid ${SnapCaveatType.SnapIds} caveat.`,
  );
}

export type { Snap as TruncatedSnap } from '@metamask/snaps-sdk';
