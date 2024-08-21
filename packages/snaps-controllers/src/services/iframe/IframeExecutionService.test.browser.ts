import { HandlerType } from '@metamask/snaps-utils';
import {
  DEFAULT_SNAP_BUNDLE,
  MOCK_ORIGIN,
  MOCK_SNAP_ID,
  spy,
} from '@metamask/snaps-utils/test-utils';
import { assert } from '@metamask/utils';

import { IframeExecutionService } from './IframeExecutionService';
import { createService, MOCK_BLOCK_NUMBER } from '../../test-utils';

const IFRAME_URL = 'http://localhost:4567';

describe('IframeExecutionService', () => {
  it('can boot', async () => {
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    expect(service).toBeDefined();
    await service.terminateAllSnaps();
  });

  it('can create a snap worker and start the snap', async () => {
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

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

  it('executes a snap', async () => {
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    await service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: DEFAULT_SNAP_BUNDLE,
      endowments: ['console'],
    });

    const result = await service.handleRpcRequest(MOCK_SNAP_ID, {
      origin: MOCK_ORIGIN,
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'foo',
      },
    });

    expect(result).toBe('foo1');

    await service.terminateAllSnaps();
  });

  it('can handle a crashed snap', async () => {
    expect.assertions(1);
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    const action = async () => {
      await service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: `
          throw new Error("Crashed.");
        `,
        endowments: [],
      });
    };

    await expect(action()).rejects.toThrow(
      `Error while running snap '${MOCK_SNAP_ID}': Crashed.`,
    );
    await service.terminateAllSnaps();
  });

  it('can detect outbound requests', async () => {
    expect.assertions(4);

    const { service, messenger } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    const publishSpy = spy(messenger, 'publish');

    const executeResult = await service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: `
        module.exports.onRpcRequest = () => ethereum.request({ method: 'eth_blockNumber', params: [] });
      `,
      endowments: ['ethereum'],
    });

    expect(executeResult).toBe('OK');

    const result = await service.handleRpcRequest(MOCK_SNAP_ID, {
      origin: 'foo',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'foobar',
        params: [],
      },
    });

    expect(result).toBe(MOCK_BLOCK_NUMBER);

    expect(publishSpy.calls).toHaveLength(2);
    expect(publishSpy.calls[0]).toStrictEqual({
      args: ['ExecutionService:outboundRequest', MOCK_SNAP_ID],
      result: undefined,
    });

    expect(publishSpy.calls[1]).toStrictEqual({
      args: ['ExecutionService:outboundResponse', MOCK_SNAP_ID],
      result: undefined,
    });

    await service.terminateAllSnaps();
    publishSpy.reset();
  });

  it('properly sandboxes the iframe', async () => {
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    await service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: DEFAULT_SNAP_BUNDLE,
      endowments: ['console'],
    });

    const iframe = document.querySelector('iframe');
    assert(iframe);

    const message = new Promise((resolve) => {
      window.addEventListener('message', (event) => {
        resolve(event.data);
      });
    });

    // Creates an iframe attempts to access the iframe created by the execution
    // service. This should fail due to the sandboxing.
    const testFrame = document.createElement('iframe');
    testFrame.src = `${IFRAME_URL}/test/sandbox`;
    document.body.appendChild(testFrame);

    expect(await message).toContain(
      'Failed to access document of the snap iframe: SecurityError',
    );
  });

  it('confirms that events are secured', async () => {
    // Check if the security critical properties of the Event object
    // are unavailable. This will confirm that executeLockdownEvents works
    // inside snaps-execution-environments
    const { service } = createService(IframeExecutionService, {
      iframeUrl: new URL(IFRAME_URL),
    });

    await service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: `
        module.exports.onRpcRequest = async ({ request }) => {
            let result;
            const promise = new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'https://metamask.io/');
                xhr.send();
                xhr.onreadystatechange = (ev) => {
                  result = ev;
                  resolve();
                };
            });
            await promise;

            return {
              targetIsUndefined: result.target === undefined,
              currentTargetIsUndefined: result.target === undefined,
              srcElementIsUndefined: result.target === undefined,
              composedPathIsUndefined: result.target === undefined
            };
        };
      `,
      endowments: ['console', 'XMLHttpRequest'],
    });

    const result = await service.handleRpcRequest(MOCK_SNAP_ID, {
      origin: 'foo',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'foobar',
        params: [],
      },
    });

    expect(result).toStrictEqual({
      targetIsUndefined: true,
      currentTargetIsUndefined: true,
      srcElementIsUndefined: true,
      composedPathIsUndefined: true,
    });
  });
});
