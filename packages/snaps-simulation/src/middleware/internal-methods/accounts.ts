import type {
  JsonRpcEngineEndCallback,
  JsonRpcEngineNextCallback,
} from '@metamask/json-rpc-engine';
import { BIP44Node } from '@metamask/key-tree';
import type {
  Json,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';

export type GetAccountsHandlerHooks = {
  getMnemonic: (keyringId?: string) => Promise<Uint8Array>;
};

/**
 * A mock handler for account related methods that always returns the first
 * address for the selected secret recovery phrase.
 *
 * @param _request - Incoming JSON-RPC request. This is ignored for this
 * specific handler.
 * @param response - The outgoing JSON-RPC response, modified to return the
 * result.
 * @param _next - The `json-rpc-engine` middleware next handler.
 * @param end - The `json-rpc-engine` middleware end handler.
 * @param hooks - Any hooks required by this handler.
 * @returns The JSON-RPC response.
 */
export async function getAccountsHandler(
  _request: JsonRpcRequest,
  response: PendingJsonRpcResponse<Json>,
  _next: JsonRpcEngineNextCallback,
  end: JsonRpcEngineEndCallback,
  hooks: GetAccountsHandlerHooks,
) {
  const { getMnemonic } = hooks;

  const node = await BIP44Node.fromDerivationPath({
    derivationPath: [
      await getMnemonic(),
      `bip32:44'`,
      `bip32:60'`,
      `bip32:0'`,
      `bip32:0`,
      `bip32:0`,
    ],
  });

  response.result = [node.address];
  return end();
}
