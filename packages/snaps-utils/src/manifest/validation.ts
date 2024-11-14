import type { SupportedCurve } from '@metamask/key-tree';
import { isValidBIP32PathSegment } from '@metamask/key-tree';
import type { EmptyObject, InitialPermissions } from '@metamask/snaps-sdk';
import type { Describe, Infer, Struct } from '@metamask/superstruct';
import {
  array,
  boolean,
  create,
  enums,
  integer,
  is,
  literal,
  object,
  optional,
  refine,
  record,
  size,
  string,
  type,
  union,
  intersection,
} from '@metamask/superstruct';
import {
  assertStruct,
  ChecksumStruct,
  VersionStruct,
  isValidSemVerRange,
  inMilliseconds,
  Duration,
  CaipChainIdStruct,
} from '@metamask/utils';

import { isEqual } from '../array';
import { CronjobSpecificationArrayStruct } from '../cronjob';
import { SIP_6_MAGIC_VALUE, STATE_ENCRYPTION_MAGIC_VALUE } from '../entropy';
import { KeyringOriginsStruct, RpcOriginsStruct } from '../json-rpc';
import { ChainIdStruct } from '../namespace';
import { SnapIdStruct } from '../snaps';
import { mergeStructs, type InferMatching } from '../structs';
import { NameStruct, NpmSnapFileNames, uri } from '../types';

// BIP-43 purposes that cannot be used for entropy derivation. These are in the
// string form, ending with `'`.
const FORBIDDEN_PURPOSES: string[] = [
  SIP_6_MAGIC_VALUE,
  STATE_ENCRYPTION_MAGIC_VALUE,
];

export const FORBIDDEN_COIN_TYPES: number[] = [60];
const FORBIDDEN_PATHS: string[][] = FORBIDDEN_COIN_TYPES.map((coinType) => [
  'm',
  "44'",
  `${coinType}'`,
]);

export const Bip32PathStruct = refine(
  array(string()),
  'BIP-32 path',
  (path: string[]) => {
    if (path.length === 0) {
      return 'Path must be a non-empty BIP-32 derivation path array';
    }

    if (path[0] !== 'm') {
      return 'Path must start with "m".';
    }

    if (path.length < 3) {
      return 'Paths must have a length of at least three.';
    }

    if (path.slice(1).some((part) => !isValidBIP32PathSegment(part))) {
      return 'Path must be a valid BIP-32 derivation path array.';
    }

    if (FORBIDDEN_PURPOSES.includes(path[1])) {
      return `The purpose "${path[1]}" is not allowed for entropy derivation.`;
    }

    if (
      FORBIDDEN_PATHS.some((forbiddenPath) =>
        isEqual(path.slice(0, forbiddenPath.length), forbiddenPath),
      )
    ) {
      return `The path "${path.join(
        '/',
      )}" is not allowed for entropy derivation.`;
    }

    return true;
  },
);

export const bip32entropy = <
  Type extends { path: string[]; curve: string },
  Schema,
>(
  struct: Struct<Type, Schema>,
) =>
  refine(struct, 'BIP-32 entropy', (value) => {
    if (
      value.curve === 'ed25519' &&
      value.path.slice(1).some((part) => !part.endsWith("'"))
    ) {
      return 'Ed25519 does not support unhardened paths.';
    }

    return true;
  });

export const CurveStruct: Describe<SupportedCurve> = enums([
  'ed25519',
  'secp256k1',
  'ed25519Bip32',
]);

// Used outside @metamask/snap-utils
export const Bip32EntropyStruct = bip32entropy(
  type({
    path: Bip32PathStruct,
    curve: CurveStruct,
  }),
);

export type Bip32Entropy = Infer<typeof Bip32EntropyStruct>;

export const SnapGetBip32EntropyPermissionsStruct = size(
  array(Bip32EntropyStruct),
  1,
  Infinity,
);

export const SemVerRangeStruct = refine(string(), 'SemVer range', (value) => {
  if (isValidSemVerRange(value)) {
    return true;
  }
  return 'Expected a valid SemVer range.';
});

export const SnapIdsStruct = refine(
  record(SnapIdStruct, object({ version: optional(SemVerRangeStruct) })),
  'SnapIds',
  (value) => {
    if (Object.keys(value).length === 0) {
      return false;
    }

    return true;
  },
);

export type SnapIds = Infer<typeof SnapIdsStruct>;

export const ChainIdsStruct = size(array(ChainIdStruct), 1, Infinity);

export const LookupMatchersStruct = union([
  object({
    tlds: size(array(string()), 1, Infinity),
  }),
  object({
    schemes: size(array(string()), 1, Infinity),
  }),
  object({
    tlds: size(array(string()), 1, Infinity),
    schemes: size(array(string()), 1, Infinity),
  }),
]);

export const MINIMUM_REQUEST_TIMEOUT = inMilliseconds(5, Duration.Second);
export const MAXIMUM_REQUEST_TIMEOUT = inMilliseconds(3, Duration.Minute);

export const MaxRequestTimeStruct = size(
  integer(),
  MINIMUM_REQUEST_TIMEOUT,
  MAXIMUM_REQUEST_TIMEOUT,
);

export const ProtocolScopesStruct = record(
  CaipChainIdStruct,
  object({ methods: array(string()) }),
);

// Utility type to union with for all handler structs
export const HandlerCaveatsStruct = object({
  maxRequestTime: optional(MaxRequestTimeStruct),
});

export type HandlerCaveats = Infer<typeof HandlerCaveatsStruct>;

export const EmptyObjectStruct = object<EmptyObject>({}) as unknown as Struct<
  EmptyObject,
  null
>;

/* eslint-disable @typescript-eslint/naming-convention */
export const PermissionsStruct: Describe<InitialPermissions> = type({
  'endowment:assets': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({ scopes: size(array(ChainIdsStruct), 1, Infinity) }),
    ),
  ),
  'endowment:cronjob': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({ jobs: optional(CronjobSpecificationArrayStruct) }),
    ),
  ),
  'endowment:ethereum-provider': optional(EmptyObjectStruct),
  'endowment:keyring': optional(
    mergeStructs(HandlerCaveatsStruct, KeyringOriginsStruct),
  ),
  'endowment:protocol': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({ scopes: ProtocolScopesStruct }),
    ),
  ),
  'endowment:lifecycle-hooks': optional(HandlerCaveatsStruct),
  'endowment:name-lookup': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({
        chains: optional(ChainIdsStruct),
        matchers: optional(LookupMatchersStruct),
      }),
    ),
  ),
  'endowment:network-access': optional(EmptyObjectStruct),
  'endowment:page-home': optional(HandlerCaveatsStruct),
  'endowment:rpc': optional(
    mergeStructs(HandlerCaveatsStruct, RpcOriginsStruct),
  ),
  'endowment:signature-insight': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({
        allowSignatureOrigin: optional(boolean()),
      }),
    ),
  ),
  'endowment:transaction-insight': optional(
    mergeStructs(
      HandlerCaveatsStruct,
      object({
        allowTransactionOrigin: optional(boolean()),
      }),
    ),
  ),
  'endowment:webassembly': optional(EmptyObjectStruct),
  snap_dialog: optional(EmptyObjectStruct),
  snap_manageState: optional(EmptyObjectStruct),
  snap_manageAccounts: optional(EmptyObjectStruct),
  snap_notify: optional(EmptyObjectStruct),
  snap_getBip32Entropy: optional(SnapGetBip32EntropyPermissionsStruct),
  snap_getBip32PublicKey: optional(SnapGetBip32EntropyPermissionsStruct),
  snap_getBip44Entropy: optional(
    size(
      array(object({ coinType: size(integer(), 0, 2 ** 32 - 1) })),
      1,
      Infinity,
    ),
  ),
  snap_getEntropy: optional(EmptyObjectStruct),
  snap_getLocale: optional(EmptyObjectStruct),
  wallet_snap: optional(SnapIdsStruct),
});
/* eslint-enable @typescript-eslint/naming-convention */

export type SnapPermissions = InferMatching<
  typeof PermissionsStruct,
  InitialPermissions
>;

export const SnapAuxilaryFilesStruct = array(string());

export const InitialConnectionsStruct = record(
  intersection([string(), uri()]),
  object({}),
);

export type InitialConnections = Infer<typeof InitialConnectionsStruct>;

export const SnapManifestStruct = object({
  version: VersionStruct,
  description: size(string(), 1, 280),
  proposedName: size(string(), 1, 214),
  repository: optional(
    type({
      type: size(string(), 1, Infinity),
      url: size(string(), 1, Infinity),
    }),
  ),
  source: object({
    shasum: ChecksumStruct,
    location: object({
      npm: object({
        filePath: size(string(), 1, Infinity),
        iconPath: optional(size(string(), 1, Infinity)),
        packageName: NameStruct,
        registry: union([
          literal('https://registry.npmjs.org'),
          literal('https://registry.npmjs.org/'),
        ]),
      }),
    }),
    files: optional(SnapAuxilaryFilesStruct),
    locales: optional(SnapAuxilaryFilesStruct),
  }),
  initialConnections: optional(InitialConnectionsStruct),
  initialPermissions: PermissionsStruct,
  manifestVersion: literal('0.1'),
  platformVersion: optional(VersionStruct),
  $schema: optional(string()), // enables JSON-Schema linting in VSC and other IDEs
});

export type SnapManifest = Infer<typeof SnapManifestStruct>;

/**
 * Check if the given value is a valid {@link SnapManifest} object.
 *
 * @param value - The value to check.
 * @returns Whether the value is a valid {@link SnapManifest} object.
 */
export function isSnapManifest(value: unknown): value is SnapManifest {
  return is(value, SnapManifestStruct);
}

/**
 * Assert that the given value is a valid {@link SnapManifest} object.
 *
 * @param value - The value to check.
 * @throws If the value is not a valid {@link SnapManifest} object.
 */
export function assertIsSnapManifest(
  value: unknown,
): asserts value is SnapManifest {
  assertStruct(
    value,
    SnapManifestStruct,
    `"${NpmSnapFileNames.Manifest}" is invalid`,
  );
}

/**
 * Creates a {@link SnapManifest} object from JSON.
 *
 * @param value - The value to check.
 * @throws If the value cannot be coerced to a {@link SnapManifest} object.
 * @returns The created {@link SnapManifest} object.
 */
export function createSnapManifest(value: unknown): SnapManifest {
  // TODO: Add a utility to prefix these errors similar to assertStruct
  return create(value, SnapManifestStruct);
}
