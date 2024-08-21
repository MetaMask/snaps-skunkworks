import { mnemonicPhraseToBytes } from '@metamask/key-tree';
import type { PendingJsonRpcResponse } from '@metamask/utils';

import { getAccountsHandler } from './accounts';
import { DEFAULT_SRP } from '../../constants';

describe('getAccountsHandler', () => {
  it('returns the first address for the selected secret recovery phrase', async () => {
    const end = jest.fn();
    const result: PendingJsonRpcResponse<string[]> = {
      jsonrpc: '2.0' as const,
      id: 1,
    };

    await getAccountsHandler(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_accounts',
        params: [],
      },
      result,
      jest.fn(),
      end,
      {
        getMnemonic: async () => {
          return mnemonicPhraseToBytes(DEFAULT_SRP);
        },
      },
    );

    expect(end).toHaveBeenCalled();
    expect(result.result).toStrictEqual([
      '0xc6d5a3c98ec9073b54fa0969957bd582e8d874bf',
    ]);
  });
});
