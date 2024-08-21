import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { rpcErrors } from '@metamask/rpc-errors';
import { logError } from '@metamask/snaps-utils';
import type { Json, JsonRpcParams } from '@metamask/utils';

import { methodHandlers } from './handlers';
import { selectHooks } from '../utils';

/**
 * Creates a middleware that handles permitted snap RPC methods.
 *
 * @param isSnap - A flag that should indicate whether the requesting origin is a snap or not.
 * @param hooks - An object containing the hooks made available to the permitted RPC methods.
 * @returns The middleware.
 */
export function createSnapsMethodMiddleware(
  isSnap: boolean,
  hooks: Record<string, unknown>,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  // This is not actually a misused promise, the type is just wrong
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return async function methodMiddleware(request, response, next, end) {
    const handler =
      methodHandlers[request.method as keyof typeof methodHandlers];
    if (handler) {
      if (
        String.prototype.startsWith.call(request.method, 'snap_') &&
        !isSnap
      ) {
        return end(rpcErrors.methodNotFound());
      }

      // TODO: Once json-rpc-engine types are up to date, we should type this correctly
      const { implementation, hookNames } = handler as any;
      try {
        // Implementations may or may not be async, so we must await them.
        return await implementation(
          request,
          response,
          next,
          end,
          selectHooks(hooks, hookNames),
        );
      } catch (error) {
        logError(error);
        return end(error);
      }
    }

    return next();
  };
}
