import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { text, type CreateInterfaceResult } from '@metamask/snaps-sdk';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';
import type { PendingJsonRpcResponse } from '@metamask/utils';

import { createInterfaceHandler } from './createInterface';

describe('snap_createInterface', () => {
  describe('createInterfaceHandler', () => {
    it('has the expected shape', () => {
      expect(createInterfaceHandler).toMatchObject({
        methodNames: ['snap_createInterface'],
        implementation: expect.any(Function),
        hookNames: {
          createInterface: true,
          hasPermission: true,
        },
      });
    });
  });

  describe('implementation', () => {
    it('returns the result from the `createInterface` hook', async () => {
      const { implementation } = createInterfaceHandler;

      const createInterface = jest.fn().mockReturnValue('foo');
      const hasPermission = jest.fn().mockReturnValue(true);

      const hooks = {
        createInterface,
        hasPermission,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          // @ts-expect-error - `origin` is not part of the type, but in practice
          // it is added by the MetaMask middleware stack.
          { ...request, origin: MOCK_SNAP_ID },
          response as PendingJsonRpcResponse<CreateInterfaceResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_createInterface',
        params: {
          ui: text('foo'),
        },
      });

      expect(response).toStrictEqual({ jsonrpc: '2.0', id: 1, result: 'foo' });
    });

    it('throws if the the snap is not allowed', async () => {
      const { implementation } = createInterfaceHandler;

      const createInterface = jest.fn().mockReturnValue('foo');
      const hasPermission = jest.fn().mockReturnValue(false);

      const hooks = {
        createInterface,
        hasPermission,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          // @ts-expect-error - `origin` is not part of the type, but in practice
          // it is added by the MetaMask middleware stack.
          { ...request, origin: MOCK_SNAP_ID },
          response as PendingJsonRpcResponse<CreateInterfaceResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_createInterface',
        params: {
          ui: text('foo'),
        },
      });

      expect(response).toStrictEqual({
        jsonrpc: '2.0',
        id: 1,
        error: expect.objectContaining({
          code: -32601,
          message: 'The method does not exist / is not available.',
        }),
      });
    });
  });

  it('throws on invalid params', async () => {
    const { implementation } = createInterfaceHandler;

    const createInterface = jest.fn().mockReturnValue('foo');
    const hasPermission = jest.fn().mockReturnValue(true);

    const hooks = {
      createInterface,
      hasPermission,
    };

    const engine = new JsonRpcEngine();

    engine.push((request, response, next, end) => {
      const result = implementation(
        // @ts-expect-error - `origin` is not part of the type, but in practice
        // it is added by the MetaMask middleware stack.
        { ...request, origin: MOCK_SNAP_ID },
        response as PendingJsonRpcResponse<CreateInterfaceResult>,
        next,
        end,
        hooks,
      );

      result?.catch(end);
    });

    const response = await engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'snap_createInterface',
      params: {
        ui: 'foo',
      },
    });

    expect(response).toStrictEqual({
      error: {
        code: -32602,
        message:
          'Invalid params: At path: ui -- Expected the value to satisfy a union of `object | object | object | object | object | object | object | object | object | object | object | object`, but received: "foo".',
        stack: expect.any(String),
      },
      id: 1,
      jsonrpc: '2.0',
    });
  });
});
