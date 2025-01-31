import { JsonRpcError } from '@metamask/rpc-errors';
import { HandlerType } from '@metamask/snaps-utils';

import { createService, MOCK_BLOCK_NUMBER } from '../../test-utils';
import { delay } from '../../utils';
import type { SnapErrorJson } from '../ExecutionService';
import { NodeProcessExecutionService } from './NodeProcessExecutionService';

const ON_RPC_REQUEST = HandlerType.OnRpcRequest;

describe('NodeProcessExecutionService', () => {
  it('can boot', async () => {
    const { service } = createService(NodeProcessExecutionService);
    expect(service).toBeDefined();
    await service.terminateAllSnaps();
  });

  it('can create a snap worker and start the snap', async () => {
    const { service } = createService(NodeProcessExecutionService);
    const response = await service.executeSnap({
      snapId: 'TestSnap',
      sourceCode: `
      module.exports.onRpcRequest = () => null;
      `,
      endowments: [],
    });
    expect(response).toBe('OK');
    await service.terminateAllSnaps();
  });

  it('can handle a crashed snap', async () => {
    expect.assertions(1);
    const { service } = createService(NodeProcessExecutionService);
    const action = async () => {
      await service.executeSnap({
        snapId: 'TestSnap',
        sourceCode: `
          throw new Error("potato");
        `,
        endowments: [],
      });
    };

    await expect(action()).rejects.toThrow(
      /Error while running snap 'TestSnap'/u,
    );
    await service.terminateAllSnaps();
  });

  it('can handle errors in request handler', async () => {
    expect.assertions(2);
    const { service } = createService(NodeProcessExecutionService);
    const snapId = 'TestSnap';
    await service.executeSnap({
      snapId,
      sourceCode: `
      module.exports.onRpcRequest = async () => { throw new Error("foobar"); };
      `,
      endowments: [],
    });

    const result = await service
      .handleRpcRequest(snapId, {
        origin: 'fooOrigin',
        handler: ON_RPC_REQUEST,
        request: {
          jsonrpc: '2.0',
          method: 'foo',
          params: {},
          id: 1,
        },
      })
      .catch((error) => error);

    expect(result).toBeInstanceOf(JsonRpcError);

    // @ts-expect-error - This is a `JsonRpcError`.
    // eslint-disable-next-line jest/prefer-strict-equal
    expect(result.serialize()).toEqual({
      code: -31001,
      message: 'Wrapped Snap Error',
      stack: expect.any(String),
      data: {
        cause: {
          message: 'foobar',
          stack: expect.any(String),
        },
      },
    });

    await service.terminateAllSnaps();
  });

  it('can handle errors out of band', async () => {
    expect.assertions(2);
    const { service, messenger } = createService(NodeProcessExecutionService);
    const snapId = 'TestSnap';
    await service.executeSnap({
      snapId,
      sourceCode: `
      module.exports.onRpcRequest = async () =>
      {
        new Promise((resolve, _reject) => {
          let num = 0;
          while (num < 100) {
            // eslint-disable-next-line no-plusplus
            num++;
          }
          throw new Error('random error inside');
          resolve(undefined);
        });
        return 'foo';
       };
      `,
      endowments: [],
    });

    const unhandledErrorPromise = new Promise((resolve) => {
      messenger.subscribe(
        'ExecutionService:unhandledError',
        (_snapId: string, error: SnapErrorJson) => {
          resolve(error);
        },
      );
    });

    expect(
      await service.handleRpcRequest(snapId, {
        origin: 'fooOrigin',
        handler: ON_RPC_REQUEST,
        request: {
          jsonrpc: '2.0',
          method: '',
          params: {},
          id: 1,
        },
      }),
    ).toBe('foo');

    // eslint-disable-next-line jest/prefer-strict-equal
    expect(await unhandledErrorPromise).toEqual({
      code: -32603,
      data: {
        snapId: 'TestSnap',
        cause: {
          message: 'random error inside',
          stack: expect.any(String),
        },
      },
      message: 'Unhandled Snap Error',
    });

    await service.terminateAllSnaps();
  });

  it('can detect outbound requests', async () => {
    expect.assertions(4);
    const { service, messenger } = createService(NodeProcessExecutionService);
    const publishSpy = jest.spyOn(messenger, 'publish');
    const snapId = 'TestSnap';
    const executeResult = await service.executeSnap({
      snapId,
      sourceCode: `
      module.exports.onRpcRequest = () => ethereum.request({ method: 'eth_blockNumber', params: [] });
      `,
      endowments: ['ethereum'],
    });

    expect(executeResult).toBe('OK');

    const result = await service.handleRpcRequest(snapId, {
      origin: 'foo',
      handler: ON_RPC_REQUEST,
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'foobar',
        params: [],
      },
    });

    expect(result).toBe(MOCK_BLOCK_NUMBER);

    expect(publishSpy).toHaveBeenCalledWith(
      'ExecutionService:outboundRequest',
      'TestSnap',
    );

    expect(publishSpy).toHaveBeenCalledWith(
      'ExecutionService:outboundResponse',
      'TestSnap',
    );

    await service.terminateAllSnaps();
  });

  it('captures stdout and stderr', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const error = jest.spyOn(console, 'error').mockImplementation();

    const { service } = createService(NodeProcessExecutionService);
    const snapId = 'TestSnap';
    const result = await service.executeSnap({
      snapId,
      sourceCode: `
        module.exports.onRpcRequest = () => null;
        console.log('foo');
        console.error('bar');
      `,
      endowments: ['console'],
    });

    await delay(100);

    expect(result).toBe('OK');
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('[Snap: TestSnap] foo'),
    );

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('[Snap: TestSnap] bar'),
    );

    await service.terminateAllSnaps();
  });
});
