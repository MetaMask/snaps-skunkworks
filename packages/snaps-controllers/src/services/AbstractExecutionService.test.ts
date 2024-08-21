import { BasePostMessageStream } from '@metamask/post-message-stream';
import { HandlerType } from '@metamask/snaps-utils';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';
import { Duration, inMilliseconds } from '@metamask/utils';

import type { ExecutionServiceArgs } from './AbstractExecutionService';
import { NodeThreadExecutionService } from './node';
import { createService } from '../test-utils';

class MockExecutionService extends NodeThreadExecutionService {
  constructor({ messenger, setupSnapProvider }: ExecutionServiceArgs) {
    super({
      messenger,
      setupSnapProvider,
      initTimeout: inMilliseconds(5, Duration.Second),
    });
  }

  getJobs() {
    return this.jobs;
  }
}

describe('AbstractExecutionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs error for unrecognized notifications', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const { service } = createService(MockExecutionService);

    await service.executeSnap({
      snapId: 'TestSnap',
      sourceCode: `
        module.exports.onRpcRequest = () => null;
      `,
      endowments: [],
    });

    const { streams } = service.getJobs().values().next().value;
    streams.command.emit('data', {
      jsonrpc: '2.0',
      method: 'foo',
    });

    await service.terminateAllSnaps();

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      new Error(`Received unexpected command stream notification "foo".`),
    );
  });

  it('logs error for malformed UnhandledError notification', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const { service } = createService(MockExecutionService);

    await service.executeSnap({
      snapId: 'TestSnap',
      sourceCode: `
      module.exports.onRpcRequest = () => null;
      `,
      endowments: [],
    });

    const { streams } = service.getJobs().values().next().value;
    streams.command.emit('data', {
      jsonrpc: '2.0',
      method: 'UnhandledError',
      params: [2],
    });

    streams.command.emit('data', {
      jsonrpc: '2.0',
      method: 'UnhandledError',
      params: { error: null },
    });

    await service.terminateAllSnaps();

    const expectedError = new Error(
      `Received malformed "UnhandledError" command stream notification.`,
    );
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, expectedError);
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, expectedError);
  });

  it('throws an error if RPC request handler is unavailable', async () => {
    const { service } = createService(MockExecutionService);
    const snapId = 'TestSnap';
    await expect(
      service.handleRpcRequest(snapId, {
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          id: 6,
          method: 'bar',
        },
      }),
    ).rejects.toThrow(
      `Snap execution service returned no RPC handler for running snap "${snapId}".`,
    );
  });

  it('throws an error if RPC request is non JSON serializable', async () => {
    const { service } = createService(MockExecutionService);
    await service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: `
         module.exports.onRpcRequest = () => null;
      `,
      endowments: [],
    });

    await expect(
      service.handleRpcRequest(MOCK_SNAP_ID, {
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          id: 6,
          method: 'bar',
          params: undefined,
        },
      }),
    ).rejects.toThrow(
      'Invalid JSON-RPC request: At path: params -- Expected the value to satisfy a union of `record | array`, but received: [object Object].',
    );

    await service.terminateAllSnaps();
  });

  it('throws an error if execution environment fails to respond to ping', async () => {
    const { service } = createService(MockExecutionService);

    class MockStream extends BasePostMessageStream {
      protected _postMessage(_data?: unknown): void {
        // no-op
      }
    }

    // @ts-expect-error Accessing private property and returning unusable worker.
    service.initEnvStream = async () =>
      Promise.resolve({ worker: null, stream: new MockStream() });

    await expect(
      service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: `
        console.log('foo');
      `,
        endowments: ['console'],
      }),
    ).rejects.toThrow('The Snaps execution environment failed to start.');
  });

  it('throws an error if execution environment fails to init', async () => {
    const { service } = createService(MockExecutionService);

    // @ts-expect-error Accessing private property and returning unusable worker.
    service.initEnvStream = async () =>
      new Promise((_resolve) => {
        // no-op
      });

    await expect(
      service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: `
        console.log('foo');
      `,
        endowments: ['console'],
      }),
    ).rejects.toThrow('The Snaps execution environment failed to start.');
  });

  it('throws an error if Snap fails to init', async () => {
    const { service } = createService(MockExecutionService);

    await expect(
      service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: `
        while(true) {}
      `,
        endowments: ['console'],
      }),
    ).rejects.toThrow(`${MOCK_SNAP_ID} failed to start.`);
  });
});
