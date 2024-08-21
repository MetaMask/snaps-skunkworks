import {
  DEFAULT_SNAP_BUNDLE,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';
import type { Json, JsonRpcRequest } from '@metamask/utils';
import { isJsonRpcRequest, isPlainObject } from '@metamask/utils';

import { WebViewExecutionService } from './WebViewExecutionService';
import type { WebViewInterface } from './WebViewMessageStream';
import { createService } from '../../test-utils';
import { parseInjectedJS } from '../../test-utils/webview';

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

describe('WebViewExecutionService', () => {
  it('can boot', async () => {
    const mockedWebView = {
      unregisterMessageListener: jest.fn(),
      registerMessageListener: jest.fn(),
      injectJavaScript: jest.fn(),
    };

    const { service } = createService(WebViewExecutionService, {
      getWebView: async () =>
        Promise.resolve(mockedWebView as unknown as WebViewInterface),
    });

    expect(service).toBeDefined();
  });

  it('can execute snaps', async () => {
    const registerMessageListener = jest.fn();
    const sendMessage = jest.fn().mockImplementation((message) => {
      // Propagate message to all listeners.
      registerMessageListener.mock.calls.forEach(([listener]) => {
        setTimeout(() => listener({ data: JSON.stringify(message) }));
      });
    });

    const injectJavaScript = jest.fn().mockImplementation((js) => {
      const parsed = parseInjectedJS(js);
      sendMessage(JSON.parse(parsed));
    });

    // Since we can't easily run the webview execution service in a real
    // environment, we mock the responses that are expected from the service.
    // This mirrors the mock from the OffscreenExecutionService
    registerMessageListener((message: { data: string }) => {
      const { target, data } = JSON.parse(message.data);

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

    const { service } = createService(WebViewExecutionService, {
      getWebView: async () =>
        Promise.resolve({
          registerMessageListener,
          unregisterMessageListener: jest.fn(),
          injectJavaScript,
        }),
    });

    expect(
      await service.executeSnap({
        snapId: MOCK_SNAP_ID,
        sourceCode: DEFAULT_SNAP_BUNDLE,
        endowments: [],
      }),
    ).toBe('OK');
  });
});
