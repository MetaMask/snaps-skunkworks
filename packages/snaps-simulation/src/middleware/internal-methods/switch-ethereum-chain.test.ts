import type { Json, PendingJsonRpcResponse } from '@metamask/utils';

import { getSwitchEthereumChainHandler } from './switch-ethereum-chain';

describe('getSwitchEthereumChainHandler', () => {
  it('returns `null`', async () => {
    const end = jest.fn();
    const result: PendingJsonRpcResponse<Json> = {
      jsonrpc: '2.0' as const,
      id: 1,
    };

    await getSwitchEthereumChainHandler(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'wallet_switchEthereumChain',
        params: [],
      },
      result,
      jest.fn(),
      end,
    );

    expect(end).toHaveBeenCalled();
    expect(result.result).toBeNull();
  });
});
