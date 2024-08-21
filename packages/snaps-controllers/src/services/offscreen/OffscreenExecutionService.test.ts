import {
  DEFAULT_SNAP_BUNDLE,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import {
  createDeferredPromise,
  isJsonRpcRequest,
  isPlainObject,
} from '@metamask/utils';

import { OffscreenExecutionService } from './OffscreenExecutionService';
import { createService } from '../../test-utils';
import { getMockedFunction } from '../../test-utils/mock';

const OFFSCREEN_PROMISE = Promise.resolve();

/**
 * Create a response message for the given request. This function assumes that
 * the response is for the parent, and uses the command stream.
 *
 * @param message - The request message.
 * @param request - The request to respond to.
 * @param response - The response to send.
 * @returns The response message.
 */
function getResponse(
  message: Record<string, unknown>,
  request: JsonRpcRequest,
  response: Json,
) {
  return {
    target: 'parent',
    data: {
      jobId: message.jobId,
      frameUrl: message.frameUrl,
      data: {
        name: 'command',
        data: {
          jsonrpc: '2.0',
          id: request.id,
          result: response,
        },
      },
    },
  };
}

describe('OffscreenExecutionService', () => {
  beforeEach(() => {
    const addListener = jest.fn();
    const sendMessage = jest.fn().mockImplementation((message) => {
      // Propagate message to all listeners.
      addListener.mock.calls.forEach(([listener]) => {
        setTimeout(() => listener(message));
      });
    });

    // Since we can't easily run the offscreen execution service in a real
    // environment, we mock the responses that are expected from the service.
    addListener((message: Record<string, unknown>) => {
      const { target, data } = message;

      if (target !== 'child') {
        return;
      }

      // Respond with a handshake acknowledgement.
      if (data === 'SYN') {
        sendMessage({ target: 'parent', data: 'ACK' });
      }

      // Handle incoming requests.
      if (
        isPlainObject(data) &&
        isPlainObject(data.data) &&
        data.data.name === 'command' &&
        isJsonRpcRequest(data.data.data)
      ) {
        const request = data.data.data;

        // Respond "OK" to the `ping`, `executeSnap`, and `terminate` request.
        if (
          request.method === 'ping' ||
          request.method === 'executeSnap' ||
          request.method === 'terminate'
        ) {
          sendMessage(getResponse(data, request, 'OK'));
        }
      }
    });

    Object.assign(global, {
      chrome: {
        runtime: {
          sendMessage,
          onMessage: {
            addListener,
            removeListener: jest.fn(),
          },
        },
      },
    });
  });

  it('can boot', async () => {
    const { service } = createService(OffscreenExecutionService, {
      offscreenPromise: OFFSCREEN_PROMISE,
    });

    expect(service).toBeDefined();
    await service.terminateAllSnaps();
  });

  it('waits for the offscreen environment to be ready', async () => {
    const { promise, resolve } = createDeferredPromise();
    const { service } = createService(OffscreenExecutionService, {
      offscreenPromise: promise,
    });

    const executePromise = service.executeSnap({
      snapId: MOCK_SNAP_ID,
      sourceCode: DEFAULT_SNAP_BUNDLE,
      endowments: [],
    });

    const sendMessage = jest.mocked(chrome.runtime.sendMessage);
    expect(sendMessage).not.toHaveBeenCalledWith({
      target: 'child',
      data: {
        jobId: expect.any(String),
        data: expect.objectContaining({
          name: 'command',
          data: expect.objectContaining({
            method: 'ping',
          }),
        }),
      },
    });

    resolve();

    expect(await executePromise).toBe('OK');
    expect(sendMessage).toHaveBeenCalledWith({
      target: 'child',
      data: {
        jobId: expect.any(String),
        data: expect.objectContaining({
          name: 'command',
          data: expect.objectContaining({
            method: 'ping',
          }),
        }),
      },
    });
  });

  it('writes a termination command to the stream', async () => {
    const { service } = createService(OffscreenExecutionService, {
      offscreenPromise: OFFSCREEN_PROMISE,
    });

    expect(
      await service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: DEFAULT_SNAP_BUNDLE,
        endowments: [],
      }),
    ).toBe('OK');

    await service.terminateSnap(MOCK_SNAP_ID);

    const sendMessage = getMockedFunction(chrome.runtime.sendMessage);
    expect(sendMessage).toHaveBeenLastCalledWith({
      target: 'child',
      data: {
        jobId: expect.any(String),
        data: {
          jsonrpc: '2.0',
          id: expect.any(String),
          method: 'terminateJob',
        },
      },
    });
  });
});
