import { createJsonRpcEngine } from './engine';
import { getMockOptions } from '../../../test-utils';
import { createStore } from '../store';

describe('createJsonRpcEngine', () => {
  it('creates a JSON-RPC engine', async () => {
    const { store } = createStore(getMockOptions());
    const engine = createJsonRpcEngine({
      store,
      hooks: {
        getMnemonic: jest.fn(),
        getSnapFile: jest.fn().mockResolvedValue('foo'),
      },
      permissionMiddleware: jest.fn(),
    });

    expect(engine).toBeDefined();
    expect(
      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_getFile',
        params: {
          path: 'foo.json',
          encoding: 'utf8',
        },
      }),
    ).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'foo',
    });
  });
});
