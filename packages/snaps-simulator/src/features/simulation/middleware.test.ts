import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { mnemonicPhraseToBytes } from '@metamask/key-tree';

import { createMiscMethodMiddleware } from './middleware';
import { DEFAULT_SRP } from '../configuration';

const hooks = { getMnemonic: async () => mnemonicPhraseToBytes(DEFAULT_SRP) };

describe('createMiscMethodMiddleware', () => {
  it('supports metamask_getProviderState', async () => {
    const engine = new JsonRpcEngine();
    engine.push(createMiscMethodMiddleware(hooks));

    const response = await engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'metamask_getProviderState',
      params: [],
    });

    expect(response).toStrictEqual({
      id: 1,
      jsonrpc: '2.0',
      result: {
        accounts: [],
        chainId: '0x01',
        isUnlocked: true,
        networkVersion: '0x01',
      },
    });
  });

  it('supports eth_accounts', async () => {
    const engine = new JsonRpcEngine();
    engine.push(createMiscMethodMiddleware(hooks));

    const response = await engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_accounts',
      params: [],
    });

    expect(response).toStrictEqual({
      id: 1,
      jsonrpc: '2.0',
      result: ['0xc6d5a3c98ec9073b54fa0969957bd582e8d874bf'],
    });
  });

  it('supports eth_requestAccounts', async () => {
    const engine = new JsonRpcEngine();
    engine.push(createMiscMethodMiddleware(hooks));

    const response = await engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_requestAccounts',
      params: [],
    });

    expect(response).toStrictEqual({
      id: 1,
      jsonrpc: '2.0',
      result: ['0xc6d5a3c98ec9073b54fa0969957bd582e8d874bf'],
    });
  });
});
