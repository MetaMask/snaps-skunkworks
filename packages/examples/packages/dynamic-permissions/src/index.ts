import { rpcErrors } from '@metamask/rpc-errors';
import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';

/**
 * Handle incoming JSON-RPC requests from the dapp, sent through the
 * `wallet_invokeSnap` method. This handler handles three methods, one for each
 * type of dynamic permissions functionality:
 *
 * - `requestPermissions`: Request all dynamic permission specified in the manifest.
 * - `getPermissions`: Retrieve all granted permissions.
 * - `revokePermissions`: Revoke all dynamic permissions.
 *
 * @param params - The request parameters.
 * @param params.request - The JSON-RPC request object.
 * @returns The JSON-RPC response.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  switch (request.method) {
    case 'requestPermissions':
      return snap.request({
        method: 'snap_requestPermissions',
        params: {
          'endowment:network-access': {},
          'endowment:webassembly': {},
          'endowment:ethereum-provider': {},
          // eslint-disable-next-line @typescript-eslint/naming-convention
          snap_getBip44Entropy: [
            {
              coinType: 3,
            },
            {
              coinType: 1,
            },
          ],
        },
      });

    case 'getPermissions':
      return snap.request({
        method: 'snap_getPermissions',
      });

    case 'revokePermissions':
      return snap.request({
        method: 'snap_revokePermissions',
        params: {
          'endowment:network-access': {},
          'endowment:webassembly': {},
          'endowment:ethereum-provider': {},
          // eslint-disable-next-line @typescript-eslint/naming-convention
          snap_getBip44Entropy: [
            {
              coinType: 3,
            },
            {
              coinType: 1,
            },
          ],
        },
      });

    default:
      throw rpcErrors.methodNotFound({
        data: {
          method: request.method,
        },
      });
  }
};
