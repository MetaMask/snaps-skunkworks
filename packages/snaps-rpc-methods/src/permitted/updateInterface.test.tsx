import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { text } from '@metamask/snaps-sdk';
import type {
  UpdateInterfaceParams,
  type UpdateInterfaceResult,
} from '@metamask/snaps-sdk';
import { Box, type JSXElement, Text } from '@metamask/snaps-sdk/jsx';
import type { JsonRpcRequest, PendingJsonRpcResponse } from '@metamask/utils';

import { updateInterfaceHandler } from './updateInterface';

describe('snap_updateInterface', () => {
  describe('updateInterfaceHandler', () => {
    it('has the expected shape', () => {
      expect(updateInterfaceHandler).toMatchObject({
        methodNames: ['snap_updateInterface'],
        implementation: expect.any(Function),
        hookNames: {
          updateInterface: true,
        },
      });
    });
  });

  describe('implementation', () => {
    it('returns the result from the `updateInterface` hook', async () => {
      const { implementation } = updateInterfaceHandler;

      const updateInterface = jest.fn();

      const hooks = {
        updateInterface,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<UpdateInterfaceParams>,
          response as PendingJsonRpcResponse<UpdateInterfaceResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_updateInterface',
        params: {
          id: 'foo',
          ui: text('foo'),
        },
      });

      expect(response).toStrictEqual({ jsonrpc: '2.0', id: 1, result: null });
    });

    it('updates a JSX interface', async () => {
      const { implementation } = updateInterfaceHandler;

      const updateInterface = jest.fn();

      const hooks = {
        updateInterface,
      };

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<UpdateInterfaceParams>,
          response as PendingJsonRpcResponse<UpdateInterfaceResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_updateInterface',
        params: {
          id: 'foo',
          ui: (
            <Box>
              <Text>Hello, world!</Text>
            </Box>
          ) as JSXElement,
        },
      });

      expect(updateInterface).toHaveBeenCalledWith(
        'foo',
        <Box>
          <Text>Hello, world!</Text>
        </Box>,
      );
    });
  });

  it('throws on invalid params', async () => {
    const { implementation } = updateInterfaceHandler;

    const updateInterface = jest.fn();

    const hooks = {
      updateInterface,
    };

    const engine = new JsonRpcEngine();

    engine.push((request, response, next, end) => {
      const result = implementation(
        request as JsonRpcRequest<UpdateInterfaceParams>,
        response as PendingJsonRpcResponse<UpdateInterfaceResult>,
        next,
        end,
        hooks,
      );

      result?.catch(end);
    });

    const response = await engine.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'snap_updateInterface',
      params: {
        id: 42,
      },
    });

    expect(response).toStrictEqual({
      error: {
        code: -32602,
        message:
          'Invalid params: At path: id -- Expected a string, but received: 42.',
        stack: expect.any(String),
      },
      id: 1,
      jsonrpc: '2.0',
    });
  });
});
