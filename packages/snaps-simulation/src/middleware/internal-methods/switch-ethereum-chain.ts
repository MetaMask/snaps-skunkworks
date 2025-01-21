import type {
  JsonRpcEngineEndCallback,
  JsonRpcEngineNextCallback,
} from '@metamask/json-rpc-engine';
import type {
  Json,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';

/**
 * A mock handler for the `wallet_switchEthereumChain` method that always
 * returns `null`.
 *
 * @param _request - Incoming JSON-RPC request. This is ignored for this
 * specific handler.
 * @param response - The outgoing JSON-RPC response, modified to return the
 * result.
 * @param _next - The `json-rpc-engine` middleware next handler.
 * @param end - The `json-rpc-engine` middleware end handler.
 * @returns The response.
 */
export async function getSwitchEthereumChainHandler(
  _request: JsonRpcRequest,
  response: PendingJsonRpcResponse<Json>,
  _next: JsonRpcEngineNextCallback,
  end: JsonRpcEngineEndCallback,
  // hooks: GetAccountsHandlerHooks,
) {
  response.result = null;
  return end();
}
