import type { AbstractExecutionService } from '@metamask/snaps-controllers';
import type { SnapId, Component } from '@metamask/snaps-sdk';
import type { HandlerType } from '@metamask/snaps-utils';
import { unwrapError } from '@metamask/snaps-utils';
import { getSafeJson, hasProperty, isPlainObject } from '@metamask/utils';
import { nanoid } from '@reduxjs/toolkit';

import type {
  RequestOptions,
  SnapHandlerInterface,
  SnapRequest,
} from '../types';
import {
  clearNotifications,
  clickElement,
  getInterface,
  getNotifications,
  typeInField,
  selectInDropdown,
} from './simulation';
import type { RunSagaFunction, Store } from './simulation';
import type { RootControllerMessenger } from './simulation/controllers';

export type HandleRequestOptions = {
  snapId: SnapId;
  store: Store;
  executionService: AbstractExecutionService<unknown>;
  handler: HandlerType;
  controllerMessenger: RootControllerMessenger;
  runSaga: RunSagaFunction;
  request: RequestOptions;
};

/**
 * Send a JSON-RPC request to the Snap, and wrap the response in a
 * {@link SnapResponse} object.
 *
 * @param options - The request options.
 * @param options.snapId - The ID of the Snap to send the request to.
 * @param options.store - The Redux store.
 * @param options.executionService - The execution service to use to send the
 * request.
 * @param options.handler - The handler to use to send the request.
 * @param options.controllerMessenger - The controller messenger used to call actions.
 * @param options.runSaga - A function to run a saga outside the usual Redux
 * flow.
 * @param options.request - The request to send.
 * @param options.request.id - The ID of the request. If not provided, a random
 * ID will be generated.
 * @param options.request.origin - The origin of the request. Defaults to
 * `https://metamask.io`.
 * @returns The response, wrapped in a {@link SnapResponse} object.
 */
export function handleRequest({
  snapId,
  store,
  executionService,
  handler,
  controllerMessenger,
  runSaga,
  request: { id = nanoid(), origin = 'https://metamask.io', ...options },
}: HandleRequestOptions): SnapRequest {
  const promise = executionService
    .handleRpcRequest(snapId, {
      origin,
      handler,
      request: {
        jsonrpc: '2.0',
        id: 1,
        ...options,
      },
    })
    .then(async (result) => {
      const notifications = getNotifications(store.getState());
      store.dispatch(clearNotifications());

      const getInterfaceFn = await getInterfaceApi(
        result,
        snapId,
        controllerMessenger,
      );

      return {
        id: String(id),
        response: {
          result: getSafeJson(result),
        },
        notifications,
        ...(getInterfaceFn ? { getInterface: getInterfaceFn } : {}),
      };
    })
    .catch((error) => {
      const [unwrappedError] = unwrapError(error);

      return {
        id: String(id),
        response: {
          error: unwrappedError.serialize(),
        },
        notifications: [],
      };
    }) as unknown as SnapRequest;

  promise.getInterface = async () => {
    return await runSaga(
      getInterface,
      runSaga,
      snapId,
      controllerMessenger,
    ).toPromise();
  };

  return promise;
}

/**
 * Get the interface ID from the result if it's available or create a new interface if the result contains static components.
 *
 * @param result - The handler result object.
 * @param snapId - The Snap ID.
 * @param controllerMessenger - The controller messenger.
 * @returns The interface ID or undefined if the result doesn't include content.
 */
export async function getInterfaceFromResult(
  result: unknown,
  snapId: SnapId,
  controllerMessenger: RootControllerMessenger,
) {
  if (isPlainObject(result) && hasProperty(result, 'id')) {
    return result.id as string;
  }

  if (isPlainObject(result) && hasProperty(result, 'content')) {
    const id = await controllerMessenger.call(
      'SnapInterfaceController:createInterface',
      snapId,
      result.content as Component,
    );

    return id;
  }

  return undefined;
}

/**
 * Get the response content from the SnapInterfaceController and include the interaction methods.
 *
 * @param result - The handler result object.
 * @param snapId - The Snap ID.
 * @param controllerMessenger - The controller messenger.
 * @returns The content components if any.
 */
export async function getInterfaceApi(
  result: unknown,
  snapId: SnapId,
  controllerMessenger: RootControllerMessenger,
): Promise<(() => SnapHandlerInterface) | undefined> {
  const interfaceId = await getInterfaceFromResult(
    result,
    snapId,
    controllerMessenger,
  );

  if (interfaceId) {
    return () => {
      const { content } = controllerMessenger.call(
        'SnapInterfaceController:getInterface',
        snapId,
        interfaceId,
      );

      return {
        content,
        clickElement: async (name) => {
          await clickElement(
            controllerMessenger,
            interfaceId,
            content,
            snapId,
            name,
          );
        },
        typeInField: async (name, value) => {
          await typeInField(
            controllerMessenger,
            interfaceId,
            content,
            snapId,
            name,
            value,
          );
        },
        selectInDropdown: async (name, value) => {
          await selectInDropdown(
            controllerMessenger,
            interfaceId,
            content,
            snapId,
            name,
            value,
          );
        },
      };
    };
  }

  return undefined;
}
