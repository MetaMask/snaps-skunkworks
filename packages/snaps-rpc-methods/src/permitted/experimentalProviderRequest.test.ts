import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { rpcErrors, serializeError } from '@metamask/rpc-errors';
import type { ProviderRequestParams } from '@metamask/snaps-sdk';
import { type ProviderRequestResult } from '@metamask/snaps-sdk';
import type {
  JsonRpcFailure,
  JsonRpcRequest,
  PendingJsonRpcResponse,
} from '@metamask/utils';

import { providerRequestHandler } from './experimentalProviderRequest';

describe('snap_experimentalProviderRequest', () => {
  describe('providerRequestHandler', () => {
    it('has the expected shape', () => {
      expect(providerRequestHandler).toMatchObject({
        methodNames: ['snap_experimentalProviderRequest'],
        implementation: expect.any(Function),
        hookNames: {
          hasPermission: true,
          getNetworkConfigurationByChainId: true,
          getNetworkClientById: true,
        },
      });
    });
  });

  describe('implementation', () => {
    const getMockHooks = () =>
      ({
        hasPermission: jest.fn().mockImplementation(() => true),
        getNetworkConfigurationByChainId: jest.fn().mockImplementation(() => ({
          defaultRpcEndpointIndex: 0,
          rpcEndpoints: [{ networkClientId: 'foo' }],
        })),
        getNetworkClientById: jest.fn().mockImplementation(() => ({
          provider: { request: jest.fn().mockResolvedValue('0x1') },
        })),
      }) as any;

    it('returns the result from the network client', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'eip155:1',
          request: {
            method: 'eth_chainId',
          },
        },
      });

      expect(response).toStrictEqual({ jsonrpc: '2.0', id: 1, result: '0x1' });
    });

    it('returns an error if the Snap does not have permission', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();
      hooks.hasPermission.mockImplementation(() => false);

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'eip155:1',
          request: {
            method: 'eth_chainId',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...rpcErrors.methodNotFound().serialize(),
        stack: expect.any(String),
      });
    });

    it('returns an error if the request is for a non-EVM network', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'bip122:000000000019d6689c085ae165831e93',
          request: {
            method: 'eth_chainId',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...rpcErrors
          .invalidParams({
            message: 'Only EVM networks are currently supported.',
          })
          .serialize(),
        stack: expect.any(String),
      });
    });

    it('returns an error if the network is not available', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      hooks.getNetworkConfigurationByChainId.mockImplementation(() => null);

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'eip155:123',
          request: {
            method: 'eth_chainId',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...rpcErrors
          .invalidParams({
            message: 'The requested network is not available.',
          })
          .serialize(),
        stack: expect.any(String),
      });
    });

    it('returns an error if the provider throws', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      hooks.getNetworkClientById.mockImplementation(() => ({
        provider: { request: jest.fn().mockRejectedValue('Invalid params') },
      }));

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'eip155:123',
          request: {
            method: 'eth_chainId',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...serializeError(
          rpcErrors.internal({ data: { cause: 'Invalid params' } }),
          { shouldIncludeStack: false },
        ),
      });
    });

    it('returns an error if the parameters are invalid', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'abcdefg',
          request: {
            method: 'eth_chainId',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...rpcErrors
          .invalidParams({
            message:
              'Invalid params: At path: chainId -- Expected a string matching `/^(?<namespace>[-a-z0-9]{3,8}):(?<reference>[-_a-zA-Z0-9]{1,32})$/` but received "abcdefg".',
          })
          .serialize(),
        stack: expect.any(String),
      });
    });

    it('returns an error if the requested method is not allowlisted', async () => {
      const { implementation } = providerRequestHandler;

      const hooks = getMockHooks();

      const engine = new JsonRpcEngine();

      engine.push((request, response, next, end) => {
        const result = implementation(
          request as JsonRpcRequest<ProviderRequestParams>,
          response as PendingJsonRpcResponse<ProviderRequestResult>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_experimentalProviderRequest',
        params: {
          chainId: 'eip155:1',
          request: {
            method: 'personal_sign',
          },
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        ...rpcErrors.methodNotFound().serialize(),
        stack: expect.any(String),
      });
    });
  });
});
