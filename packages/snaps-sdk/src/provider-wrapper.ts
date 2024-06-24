import type {
  ClearStateOperation,
  CreateInterfaceParams,
  GetBip32EntropyParams,
  GetBip32PublicKeyParams,
  GetBip44EntropyParams,
  GetEntropyParams,
  GetFileParams,
  GetStateOperation,
  NotifyParams,
  UpdateInterfaceParams,
  UpdateStateOperation,
} from './types';
import { AuxiliaryFileEncoding, ManageStateOperation } from './types';

/**
 * Retrieve BIP-32 entropy for the specified curve and path.
 *
 * @param curve - The curve to use for BIP-32 key derivation.
 * @param path - The BIP-32 derivation path.
 * @returns A promise that resolves to a BIP-32 node.
 */
export async function getBip32Entropy(
  curve: GetBip32EntropyParams['curve'],
  path: GetBip32EntropyParams['path'],
) {
  return snap.request({
    method: 'snap_getBip32Entropy',
    params: { curve, path },
  });
}

/**
 * Retrieve BIP-32 public key for the specified curve and path.
 *
 * @param curve - The curve to use for BIP-32 key derivation.
 * @param path - The BIP-32 derivation path.
 * @param compressed - Whether the public key should be compressed (default: false).
 * @returns A promise that resolves to the BIP-32 public key in hexadecimal.
 */
export async function getBip32PublicKey(
  curve: GetBip32PublicKeyParams['curve'],
  path: GetBip32PublicKeyParams['path'],
  compressed: GetBip32PublicKeyParams['compressed'] = false,
) {
  return snap.request({
    method: 'snap_getBip32PublicKey',
    params: { curve, path, compressed },
  });
}

/**
 * Retrieve BIP-44 entropy for the specified coin type.
 *
 * @param coinType - The coin type used for BIP-44 key derivation.
 * @returns A promise that resolves to a BIP-44 node.
 */
export async function getBip44Entropy(
  coinType: GetBip44EntropyParams['coinType'],
) {
  return snap.request({
    method: 'snap_getBip44Entropy',
    params: { coinType },
  });
}

/**
 * Retrieve status of the client.
 *
 * @returns A promise that resolves to an object containing
 * useful information about the client.
 */
export async function getClientStatus() {
  return snap.request({
    method: 'snap_getClientStatus',
  });
}

/**
 * Retrieve entropy for the specified version and salt.
 *
 * @param version - The version of the entropy (default: 1).
 * @param salt - The salt to use for entropy generation.
 * @returns A promise that resolves to the entropy.
 */
export async function getEntropy(
  version: GetEntropyParams['version'] = 1,
  salt?: GetEntropyParams['salt'],
) {
  return snap.request({
    method: 'snap_getEntropy',
    params: { version, salt },
  });
}

/**
 * Retrieve content of a file at the specified path.
 *
 * @param path - The path of the file.
 * @param encoding - The encoding to use for the file content (default: AuxiliaryFileEncoding.Base64).
 * @returns A promise that resolves to the file content.
 */
export async function getFile(
  path: GetFileParams['path'],
  encoding: GetFileParams['encoding'] = AuxiliaryFileEncoding.Base64,
) {
  return snap.request({
    method: 'snap_getFile',
    params: { path, encoding },
  });
}

/**
 * Retrieve currently selected user locale.
 *
 * @returns A promise that resolves to the locale.
 */
export async function getLocale() {
  return snap.request({ method: 'snap_getLocale' });
}

/**
 * Set the state to a JSON blob, overwriting the existing state.
 *
 * The state is located in two buckets, encrypted and unencrypted.
 * A boolean flag can be used to toggle between the two buckets.
 *
 * @param newState - A JSON blob to set as the state.
 * @param encrypted - Whether the state should be encrypted (default: true).
 * @returns A promise that resolves when the state is set.
 */
export async function setState(
  newState: UpdateStateOperation['newState'],
  encrypted: UpdateStateOperation['encrypted'] = true,
) {
  return snap.request({
    method: 'snap_manageState',
    params: {
      operation: ManageStateOperation.UpdateState,
      newState,
      encrypted,
    },
  });
}

/**
 * Retrieve the current state JSON blob.
 *
 * The state is located in two buckets, encrypted and unencrypted.
 * A boolean flag can be used to toggle between the two buckets.
 *
 * @param encrypted - Whether to get the encrypted or the unencrypted state (default: true).
 * @returns A promise that resolves to the current state.
 */
export async function getState(
  encrypted: GetStateOperation['encrypted'] = true,
) {
  return snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.GetState, encrypted },
  });
}

/**
 * Clear the current state blob, setting it to null.
 *
 * The state is located in two buckets, encrypted and unencrypted.
 * A boolean flag can be used to toggle between the two buckets.
 *
 * @param encrypted - Whether the state should be encrypted (default: true).
 * @returns A promise that resolves when the state is cleared.
 */
export async function clearState(
  encrypted: ClearStateOperation['encrypted'] = true,
) {
  return snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.ClearState, encrypted },
  });
}

/**
 * Send a notification with the specified type and message.
 *
 * @param type - The type of the notification.
 * @param message - The message of the notification.
 * @returns A promise that resolves when the notification is sent.
 */
export async function notify(
  type: NotifyParams['type'],
  message: NotifyParams['message'],
) {
  return snap.request({ method: 'snap_notify', params: { type, message } });
}

/**
 * Create a new interface with the specified UI.
 *
 * @param ui - The UI of the interface.
 * @param context - An optional context blob for the interface.
 * @returns A promise that resolves to the interface ID.
 */
export async function createInterface(
  ui: CreateInterfaceParams['ui'],
  context?: CreateInterfaceParams['context'],
) {
  return snap.request({
    method: 'snap_createInterface',
    params: { ui, context },
  });
}

/**
 * Update the interface with the specified ID and UI.
 *
 * @param id - The ID of the interface to update.
 * @param ui - The updated UI of the interface.
 * @returns A promise that resolves when the interface is updated.
 */
export async function updateInterface(
  id: UpdateInterfaceParams['id'],
  ui: UpdateInterfaceParams['ui'],
) {
  return snap.request({ method: 'snap_updateInterface', params: { id, ui } });
}

// TODO: Manage account APIs
// TODO: Dialog
