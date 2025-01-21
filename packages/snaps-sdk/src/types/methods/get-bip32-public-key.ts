import type { Bip32Entropy } from '../permissions';

/**
 * The request parameters for the `snap_getBip32PublicKey` method.
 *
 * @property path - The BIP-32 path to derive the public key from.
 * @property curve - The curve to use when deriving the public key.
 * @property compressed - Whether to return the compressed public key. Defaults
 * to `false`.
 */
export type GetBip32PublicKeyParams = Bip32Entropy & {
  keyringId?: string;
  compressed?: boolean;
};

/**
 * The result returned by the `snap_getBip32PublicKey` method.
 *
 * It is the public key in hexadecimal format, in either compressed or
 * uncompressed format, depending on the `compressed` parameter.
 */
export type GetBip32PublicKeyResult = string;
