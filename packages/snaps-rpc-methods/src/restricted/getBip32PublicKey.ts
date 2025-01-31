import type { CryptographicFunctions } from '@metamask/key-tree';
import type {
  PermissionSpecificationBuilder,
  PermissionValidatorConstraint,
  RestrictedMethodOptions,
  ValidPermissionSpecification,
} from '@metamask/permission-controller';
import { PermissionType, SubjectType } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import type {
  GetBip32PublicKeyParams,
  GetBip32PublicKeyResult,
} from '@metamask/snaps-sdk';
import {
  bip32entropy,
  Bip32PathStruct,
  CurveStruct,
  SnapCaveatType,
} from '@metamask/snaps-utils';
import { boolean, object, optional } from '@metamask/superstruct';
import type { NonEmptyArray } from '@metamask/utils';
import { assertStruct } from '@metamask/utils';

import type { MethodHooksObject } from '../utils';
import { getNode } from '../utils';

const targetName = 'snap_getBip32PublicKey';

export type GetBip32PublicKeyMethodHooks = {
  /**
   * @param keyringId - The ID of the keyring to get the mnemonic for.
   * @returns The mnemonic of the user's keyring, if the keyringId is not provided, it will return the mnemonic of the primary keyring.
   */
  getMnemonic: (keyringId?: string) => Promise<Uint8Array>;

  /**
   * Waits for the extension to be unlocked.
   *
   * @returns A promise that resolves once the extension is unlocked.
   */
  getUnlockPromise: (shouldShowUnlockRequest: boolean) => Promise<void>;

  /**
   * Get the cryptographic functions to use for the client. This may return an
   * empty object or `undefined` to fall back to the default cryptographic
   * functions.
   *
   * @returns The cryptographic functions to use for the client.
   */
  getClientCryptography: () => CryptographicFunctions | undefined;
};

type GetBip32PublicKeySpecificationBuilderOptions = {
  methodHooks: GetBip32PublicKeyMethodHooks;
};

type GetBip32PublicKeySpecification = ValidPermissionSpecification<{
  permissionType: PermissionType.RestrictedMethod;
  targetName: typeof targetName;
  methodImplementation: ReturnType<typeof getBip32PublicKeyImplementation>;
  allowedCaveats: Readonly<NonEmptyArray<string>> | null;
  validator: PermissionValidatorConstraint;
}>;

export const Bip32PublicKeyArgsStruct = bip32entropy(
  object({
    path: Bip32PathStruct,
    curve: CurveStruct,
    compressed: optional(boolean()),
  }),
);

/**
 * The specification builder for the `snap_getBip32PublicKey` permission.
 * `snap_getBip32PublicKey` lets the Snap retrieve public keys for a particular
 * BIP-32 node.
 *
 * @param options - The specification builder options.
 * @param options.methodHooks - The RPC method hooks needed by the method implementation.
 * @returns The specification for the `snap_getBip32PublicKey` permission.
 */
const specificationBuilder: PermissionSpecificationBuilder<
  PermissionType.RestrictedMethod,
  GetBip32PublicKeySpecificationBuilderOptions,
  GetBip32PublicKeySpecification
> = ({ methodHooks }: GetBip32PublicKeySpecificationBuilderOptions) => {
  return {
    permissionType: PermissionType.RestrictedMethod,
    targetName,
    allowedCaveats: [SnapCaveatType.PermittedDerivationPaths],
    methodImplementation: getBip32PublicKeyImplementation(methodHooks),
    validator: ({ caveats }) => {
      if (
        caveats?.length !== 1 ||
        caveats[0].type !== SnapCaveatType.PermittedDerivationPaths
      ) {
        throw rpcErrors.invalidParams({
          message: `Expected a single "${SnapCaveatType.PermittedDerivationPaths}" caveat.`,
        });
      }
    },
    subjectTypes: [SubjectType.Snap],
  };
};

const methodHooks: MethodHooksObject<GetBip32PublicKeyMethodHooks> = {
  getMnemonic: true,
  getUnlockPromise: true,
  getClientCryptography: true,
};

export const getBip32PublicKeyBuilder = Object.freeze({
  targetName,
  specificationBuilder,
  methodHooks,
} as const);

/**
 * Builds the method implementation for `snap_getBip32PublicKey`.
 *
 * @param hooks - The RPC method hooks.
 * @param hooks.getMnemonic - A function to retrieve the Secret Recovery Phrase of the user.
 * @param hooks.getUnlockPromise - A function that resolves once the MetaMask extension is unlocked
 * and prompts the user to unlock their MetaMask if it is locked.
 * @param hooks.getClientCryptography - A function to retrieve the cryptographic
 * functions to use for the client.
 * @returns The method implementation which returns a public key.
 * @throws If the params are invalid.
 */
export function getBip32PublicKeyImplementation({
  getMnemonic,
  getUnlockPromise,
  getClientCryptography,
}: GetBip32PublicKeyMethodHooks) {
  return async function getBip32PublicKey(
    args: RestrictedMethodOptions<GetBip32PublicKeyParams>,
  ): Promise<GetBip32PublicKeyResult> {
    await getUnlockPromise(true);

    assertStruct(
      args.params,
      Bip32PublicKeyArgsStruct,
      'Invalid BIP-32 public key params',
      rpcErrors.invalidParams,
    );

    const { params } = args;
    const node = await getNode({
      curve: params.curve,
      path: params.path,
      secretRecoveryPhrase: await getMnemonic(params.keyringId),
      cryptographicFunctions: getClientCryptography(),
    });

    if (params.compressed) {
      return node.compressedPublicKey;
    }

    return node.publicKey;
  };
}
