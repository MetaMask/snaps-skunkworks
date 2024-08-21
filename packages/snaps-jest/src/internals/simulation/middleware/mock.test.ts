import { JsonRpcEngine } from '@metamask/json-rpc-engine';

import { createMockMiddleware } from './mock';
import { getMockOptions } from '../../../test-utils';
import { createStore } from '../store';
import { addJsonRpcMock } from '../store/mocks';

describe('createMockMiddleware', () => {
  it('mocks a JSON-RPC method', async () => {
    const { store } = createStore(getMockOptions());
    store.dispatch(
      addJsonRpcMock({
        method: 'foo',
        result: 'bar',
      }),
    );

    const engine = new JsonRpcEngine();
    engine.push(createMockMiddleware(store));

    expect(
      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'foo',
      }),
    ).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'bar',
    });
  });

  it('calls the next middleware if no mock is found', async () => {
    const { store } = createStore(getMockOptions());
    const engine = new JsonRpcEngine();

    engine.push(createMockMiddleware(store));
    engine.push((_request, response, _next, end) => {
      response.result = 'next';
      end();
    });

    expect(
      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'foo',
      }),
    ).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'next',
    });
  });
});
