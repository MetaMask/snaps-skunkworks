import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { logError } from '@metamask/snaps-utils';
import type { Json, JsonRpcParams } from '@metamask/utils';

import { getAccountsHandler } from './accounts';
import { getChainIdHandler } from './chain-id';
import { getNetworkVersionHandler } from './net-version';
import { getProviderStateHandler } from './provider-state';
import { getSwitchEthereumChainHandler } from './switch-ethereum-chain';

export type InternalMethodsMiddlewareHooks = {
  /**
   * A hook that returns the user's secret recovery phrase.
   *
   * @returns The user's secret recovery phrase.
   */
  getMnemonic: () => Promise<Uint8Array>;
};

const methodHandlers = {
  /* eslint-disable @typescript-eslint/naming-convention */
  metamask_getProviderState: getProviderStateHandler,
  eth_requestAccounts: getAccountsHandler,
  eth_accounts: getAccountsHandler,
  eth_chainId: getChainIdHandler,
  net_version: getNetworkVersionHandler,
  wallet_switchEthereumChain: getSwitchEthereumChainHandler,
  /* eslint-enable @typescript-eslint/naming-convention */
};

/**
 * Create a middleware for handling JSON-RPC methods normally handled internally
 * by the MetaMask client.
 *
 * NOTE: This middleware provides all `hooks` to all handlers and should
 * therefore NOT be used outside of the simulation environment. It is intended
 * for testing purposes only.
 *
 * @param hooks - Any hooks used by the middleware handlers.
 * @returns A middleware function.
 */
export function createInternalMethodsMiddleware(
  hooks: InternalMethodsMiddlewareHooks,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  // This should probably use createAsyncMiddleware.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return async function methodMiddleware(request, response, next, end) {
    const handler =
      methodHandlers[request.method as keyof typeof methodHandlers];
    if (handler) {
      try {
        // Implementations may or may not be async, so we must await them.
        return await handler(request, response, next, end, hooks);
      } catch (error: any) {
        logError(error);
        return end(error);
      }
    }

    return next();
  };
}
