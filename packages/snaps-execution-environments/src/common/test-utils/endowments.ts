// @ts-expect-error Walker has no types yet.
import { walk } from '@lavamoat/lavatube';
import { createIdRemapMiddleware } from '@metamask/json-rpc-engine';
import ObjectMultiplex from '@metamask/object-multiplex';
import type { RequestArguments } from '@metamask/providers';
import { StreamProvider } from '@metamask/providers/stream-provider';
import { SNAP_STREAM_NAMES } from '@metamask/snaps-utils';

import { SILENT_LOGGER } from './logger';
import {
  assertEthereumOutboundRequest,
  proxyStreamProvider,
  withTeardown,
} from '../utils';

/**
 * Object walker test utility function.
 * This function will instantiate and configure @lavamoat/lavatube for testing
 * endowment specific use case. It will also adapt its result to a boolean value.
 *
 * @param subject - Subject to be tested.
 * @param target - Target object.
 * @returns True if target object is found, false otherwise.
 */
export function walkAndSearch(subject: unknown, target: unknown) {
  let result = false;
  walk(
    subject,
    (value: unknown) => {
      result = target === value;
      return result;
    },
    { maxRecursionLimit: 100, onShouldIgnoreError: () => true },
  );
  return result;
}

/**
 * Create and return mocked stream provider instance used for testing.
 * Note: Stream is wrapped in a Proxy to simulate limited provider used in
 * BaseSnapExecutor for ethereum endowment.
 *
 * @returns Proxy to StreamProvider instance.
 */
export function getMockedStreamProvider() {
  const mux = new ObjectMultiplex();
  const rpcStream = mux.createStream(SNAP_STREAM_NAMES.JSON_RPC);

  const provider = new StreamProvider(rpcStream, {
    jsonRpcStreamName: 'metamask-provider',
    rpcMiddleware: [createIdRemapMiddleware()],
    logger: SILENT_LOGGER,
  });

  const originalRequest = provider.request.bind(provider);

  const request = async (args: RequestArguments) => {
    assertEthereumOutboundRequest(args);
    return await withTeardown(originalRequest(args), { lastTeardown: 0 });
  };

  return proxyStreamProvider(request);
}
