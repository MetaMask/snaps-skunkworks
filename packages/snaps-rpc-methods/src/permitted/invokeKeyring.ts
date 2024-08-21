import type { JsonRpcEngineEndCallback } from '@metamask/json-rpc-engine';
import type { PermittedHandlerExport } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import type {
  InvokeKeyringParams,
  InvokeKeyringResult,
  InvokeSnapParams,
} from '@metamask/snaps-sdk';
import type { Snap, SnapRpcHookArgs } from '@metamask/snaps-utils';
import { HandlerType, WALLET_SNAP_PERMISSION_KEY } from '@metamask/snaps-utils';
import { hasProperty } from '@metamask/utils';
import type {
  PendingJsonRpcResponse,
  JsonRpcRequest,
  type Json,
} from '@metamask/utils';

import { getValidatedParams } from './invokeSnapSugar';
import type { MethodHooksObject } from '../utils';

const hookNames: MethodHooksObject<InvokeKeyringHooks> = {
  hasPermission: true,
  handleSnapRpcRequest: true,
  getSnap: true,
  getAllowedKeyringMethods: true,
};

/**
 * `wallet_invokeKeyring` gets the requester's permitted and installed Snaps.
 */
export const invokeKeyringHandler: PermittedHandlerExport<
  InvokeKeyringHooks,
  InvokeSnapParams,
  InvokeKeyringResult
> = {
  methodNames: ['wallet_invokeKeyring'],
  implementation: invokeKeyringImplementation,
  hookNames,
};

export type InvokeKeyringHooks = {
  hasPermission: (permissionName: string) => boolean;

  handleSnapRpcRequest: ({
    snapId,
    handler,
    request,
  }: Omit<SnapRpcHookArgs, 'origin'> & { snapId: string }) => Promise<unknown>;

  getSnap: (snapId: string) => Snap | undefined;

  getAllowedKeyringMethods: () => string[];
};

/**
 * The `wallet_invokeKeyring` method implementation.
 * Invokes onKeyringRequest if the snap requested is installed and connected to the dapp.
 *
 * @param req - The JSON-RPC request object.
 * @param res - The JSON-RPC response object.
 * @param _next - The `json-rpc-engine` "next" callback. Not used by this
 * function.
 * @param end - The `json-rpc-engine` "end" callback.
 * @param hooks - The RPC method hooks.
 * @param hooks.handleSnapRpcRequest - Invokes a snap with a given RPC request.
 * @param hooks.hasPermission - Checks whether a given origin has a given permission.
 * @param hooks.getSnap - Gets information about a given snap.
 * @param hooks.getAllowedKeyringMethods - Get the list of allowed Keyring
 * methods for a given origin.
 * @returns Nothing.
 */
async function invokeKeyringImplementation(
  req: JsonRpcRequest<InvokeKeyringParams>,
  res: PendingJsonRpcResponse<InvokeKeyringResult>,
  _next: unknown,
  end: JsonRpcEngineEndCallback,
  {
    handleSnapRpcRequest,
    hasPermission,
    getSnap,
    getAllowedKeyringMethods,
  }: InvokeKeyringHooks,
): Promise<void> {
  let params: InvokeSnapParams;
  try {
    params = getValidatedParams(req.params);
  } catch (error) {
    return end(error);
  }

  // We expect the MM middleware stack to always add the origin to requests
  const { origin } = req as JsonRpcRequest & { origin: string };
  const { snapId, request } = params;

  if (!origin || !hasPermission(WALLET_SNAP_PERMISSION_KEY)) {
    return end(
      rpcErrors.invalidRequest({
        message: `The snap "${snapId}" is not connected to "${origin}". Please connect before invoking the snap.`,
      }),
    );
  }

  if (!getSnap(snapId)) {
    return end(
      rpcErrors.invalidRequest({
        message: `The snap "${snapId}" is not installed. Please install it first, before invoking the snap.`,
      }),
    );
  }

  if (!hasProperty(request, 'method') || typeof request.method !== 'string') {
    return end(
      rpcErrors.invalidRequest({
        message: 'The request must have a method.',
      }),
    );
  }

  const allowedMethods = getAllowedKeyringMethods();
  if (!allowedMethods.includes(request.method)) {
    return end(
      rpcErrors.invalidRequest({
        message: `The origin "${origin}" is not allowed to invoke the method "${request.method}".`,
      }),
    );
  }

  try {
    res.result = (await handleSnapRpcRequest({
      snapId,
      request,
      handler: HandlerType.OnKeyringRequest,
    })) as Json;
  } catch (error) {
    return end(error);
  }

  return end();
}
