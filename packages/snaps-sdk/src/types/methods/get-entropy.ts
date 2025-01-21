import type { Hex } from '@metamask/utils';

/**
 * The request parameters for the `snap_getEntropy` method.
 *
 * @property version - The version of the entropy to retrieve. This is used for
 * backwards compatibility. As of now, only version 1 is supported.
 * @property salt - The optional salt to use when deriving the entropy.
 * @property keyringId - The ID of the keyring to get the mnemonic for.
 */
export type GetEntropyParams = {
  version: 1;
  salt?: string;
  keyringId?: string;
};

/**
 * The result returned by the `snap_getEntropy` method.
 */
export type GetEntropyResult = Hex;
