import type { SeverityLevel } from './transaction';
import type { EnumToUnion } from '../../internals';
import type { Component } from '../../ui';

/**
 * An eth_sign signature object.
 *
 * @property from - The address the signature is being sent from.
 * @property data - The data (hex string) that is being signed.
 * @property signatureMethod - The signature method, which in this case is eth_sign
 */
export type EthSignature = {
  from: string;
  data: string;
  signatureMethod: 'eth_sign';
};

/**
 * A personal_sign signature object.
 *
 * @property from - The address the signature is being sent from.
 * @property data - The data (hex string) that is being signed.
 * @property signatureMethod - The signature method, which in this case is personal_sign
 */
export type PersonalSignature = {
  from: string;
  data: string;
  signatureMethod: 'personal_sign';
};

/**
 * An eth_signTypedData signature object.
 *
 * @property from - The address the signature is being sent from.
 * @property data - The data that is being signed.
 * @property signatureMethod - The signature method, which in this case is eth_signTypedData
 */
export type SignTypedDataSignature = {
  from: string;
  data: Record<string, any>[];
  signatureMethod: 'eth_signTypedData';
};

/**
 * An eth_signTypedData_v3 signature object.
 *
 * @property from - The address the signature is being sent from.
 * @property data - The data that is being signed.
 * @property signatureMethod - The signature method, which in this case is eth_signTypedData_v3
 */
export type SignTypedDataV3Signature = {
  from: string;
  data: Record<string, any>;
  signatureMethod: 'eth_signTypedData_v3';
};

/**
 * An eth_signTypedData_v4 signature object.
 *
 * @property from - The address the signature is being sent from.
 * @property data - The data that is being signed.
 * @property signatureMethod - The signature method, which in this case is eth_signTypedData_v4
 */
export type SignTypedDataV4Signature = {
  from: string;
  data: Record<string, any>;
  signatureMethod: 'eth_signTypedData_v4';
};

/**
 * A signature object. This can be one of the below signature methods.
 *
 * @see EthSignature
 * @see PersonalSignature
 * @see SignTypedDataSignature
 * @see SignTypedDataV3Signature
 * @see SignTypedDataV4Signature
 */
export type Signature =
  | EthSignature
  | PersonalSignature
  | SignTypedDataSignature
  | SignTypedDataV3Signature
  | SignTypedDataV4Signature;

/**
 * The `onSignature` handler. This is called whenever a signature is
 * submitted to the snap. It can return insights about the signature, which
 * will be displayed to the user.
 *
 * Note that using this handler requires the `endowment:signature-insight`
 * permission.
 *
 * @param args - The request arguments.
 * @param args.signature - The signature object that contains the from address,
 * data and signature method.
 * @param args.signatureOrigin - The origin of the signature. This is the
 * URL of the website that submitted the signature. This is only available if
 * the Snap has enabled the `allowSignatureOrigin` option in the
 * `endowment:signature-insight` permission.
 * @returns An object containing insights about the signature. See
 * {@link OnSignatureResponse}. Can also return `null` if no insights are
 * available.
 */
export type OnSignatureHandler = (args: {
  signature: Signature;
  signatureOrigin?: string;
}) => Promise<OnSignatureResponse | null>;

/**
 * The response from a Snap's `onSignature` handler.
 *
 * @property component - A custom UI component, that will be shown in MetaMask.
 * @property id - A Snap interface ID.
 * @property severity - The severity level of the content. Currently only one
 * level is supported: `critical`.
 */
export type OnSignatureResponse =
  | {
      content: Component;
      severity?: EnumToUnion<SeverityLevel>;
    }
  | {
      id: string;
      severity?: EnumToUnion<SeverityLevel>;
    };
