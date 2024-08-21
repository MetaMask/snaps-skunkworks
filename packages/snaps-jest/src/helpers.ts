import type { AbstractExecutionService } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';
import { DialogType } from '@metamask/snaps-sdk';
import type { FooterElement } from '@metamask/snaps-sdk/jsx';
import { HandlerType, getJsxChildren, logInfo } from '@metamask/snaps-utils';
import { create } from '@metamask/superstruct';
import {
  assert,
  assertStruct,
  createModuleLogger,
  hasProperty,
} from '@metamask/utils';

import {
  rootLogger,
  handleRequest,
  TransactionOptionsStruct,
  getEnvironment,
  JsonRpcMockOptionsStruct,
  SignatureOptionsStruct,
  SnapResponseWithInterfaceStruct,
  getElementByType,
} from './internals';
import type { InstallSnapOptions } from './internals';
import {
  addJsonRpcMock,
  removeJsonRpcMock,
} from './internals/simulation/store/mocks';
import type {
  SnapResponseWithInterface,
  CronjobOptions,
  JsonRpcMockOptions,
  Snap,
  SnapResponse,
  TransactionOptions,
  SnapInterface,
  SnapAlertInterface,
  SnapInterfaceActions,
  SnapConfirmationInterface,
  SnapPromptInterface,
  DefaultSnapInterface,
  DefaultSnapInterfaceWithFooter,
  DefaultSnapInterfaceWithPartialFooter,
  DefaultSnapInterfaceWithoutFooter,
} from './types';

const log = createModuleLogger(rootLogger, 'helpers');

/**
 * Get the options for {@link installSnap}.
 *
 * @param snapId - The ID of the Snap, or the options.
 * @param options - The options, if any.
 * @returns The options.
 */
function getOptions<
  Service extends new (...args: any[]) => InstanceType<
    typeof AbstractExecutionService
  >,
>(
  snapId: SnapId | Partial<InstallSnapOptions<Service>> | undefined,
  options: Partial<InstallSnapOptions<Service>>,
): [SnapId | undefined, Partial<InstallSnapOptions<Service>>] {
  if (typeof snapId === 'object') {
    return [undefined, snapId];
  }

  return [snapId, options];
}

/**
 * Ensure that the actual response contains `getInterface`.
 *
 * @param response - The response of the handler.
 */
function assertIsResponseWithInterface(
  response: SnapResponse,
): asserts response is SnapResponseWithInterface {
  assertStruct(response, SnapResponseWithInterfaceStruct);
}

/**
 * Ensure that the actual interface is an alert dialog.
 *
 * @param ui - The interface to verify.
 */
export function assertIsAlertDialog(
  ui: SnapInterface,
): asserts ui is SnapAlertInterface & SnapInterfaceActions {
  assert(hasProperty(ui, 'type') && ui.type === DialogType.Alert);
}

/**
 * Ensure that the actual interface is a confirmation dialog.
 *
 * @param ui - The interface to verify.
 */
export function assertIsConfirmationDialog(
  ui: SnapInterface,
): asserts ui is SnapConfirmationInterface & SnapInterfaceActions {
  assert(hasProperty(ui, 'type') && ui.type === DialogType.Confirmation);
}

/**
 * Ensure that the actual interface is a Prompt dialog.
 *
 * @param ui - The interface to verify.
 */
export function assertIsPromptDialog(
  ui: SnapInterface,
): asserts ui is SnapPromptInterface & SnapInterfaceActions {
  assert(hasProperty(ui, 'type') && ui.type === DialogType.Prompt);
}

/**
 * Ensure that the actual interface is a custom dialog.
 *
 * @param ui - The interface to verify.
 */
export function assertIsCustomDialog(
  ui: SnapInterface,
): asserts ui is DefaultSnapInterface & SnapInterfaceActions {
  assert(!hasProperty(ui, 'type'));
}

/**
 * Ensure that the actual interface is a custom dialog with a complete footer.
 *
 * @param ui - The interface to verify.
 */
export function assertCustomDialogHasFooter(
  ui: DefaultSnapInterface & SnapInterfaceActions,
): asserts ui is DefaultSnapInterfaceWithFooter & SnapInterfaceActions {
  const footer = getElementByType<FooterElement>(ui.content, 'Footer');

  assert(footer && getJsxChildren(footer).length === 2);
}

/**
 * Ensure that the actual interface is a custom dialog with a partial footer.
 *
 * @param ui - The interface to verify.
 */
export function assertCustomDialogHasPartialFooter(
  ui: DefaultSnapInterface & SnapInterfaceActions,
): asserts ui is DefaultSnapInterfaceWithPartialFooter & SnapInterfaceActions {
  const footer = getElementByType<FooterElement>(ui.content, 'Footer');

  assert(footer && getJsxChildren(footer).length === 1);
}

/**
 * Ensure that the actual interface is a custom dialog without a footer.
 *
 * @param ui - The interface to verify.
 */
export function assertCustomDialogHasNoFooter(
  ui: DefaultSnapInterface & SnapInterfaceActions,
): asserts ui is DefaultSnapInterfaceWithoutFooter & SnapInterfaceActions {
  const footer = getElementByType<FooterElement>(ui.content, 'Footer');

  assert(!footer);
}

/**
 * Load a snap into the environment. This is the main entry point for testing
 * snaps: It returns a {@link Snap} object that can be used to interact with the
 * snap.
 *
 * @example
 * import { installSnap } from '@metamask/snaps-jest';
 *
 * describe('My Snap', () => {
 *   it('should do something', async () => {
 *     const { request } = await installSnap('local:my-snap');
 *     const response = await request({
 *       method: 'foo',
 *       params: ['bar'],
 *     });
 *     expect(response).toRespondWith('bar');
 *   });
 * });
 * @returns The snap.
 * @throws If the built-in server is not running, and no snap ID is provided.
 */
export async function installSnap(): Promise<Snap>;

/**
 * Load a snap into the environment. This is the main entry point for testing
 * snaps: It returns a {@link Snap} object that can be used to interact with the
 * snap.
 *
 * @example
 * import { installSnap } from '@metamask/snaps-jest';
 *
 * describe('My Snap', () => {
 *   it('should do something', async () => {
 *     const { request } = await installSnap('local:my-snap');
 *     const response = await request({
 *       method: 'foo',
 *       params: ['bar'],
 *     });
 *     expect(response).toRespondWith('bar');
 *   });
 * });
 * @param options - The options to use.
 * @param options.executionService - The execution service to use. Defaults to
 * {@link NodeThreadExecutionService}. You do not need to provide this unless
 * you are testing a custom execution service.
 * @param options.executionServiceOptions - The options to use when creating the
 * execution service, if any. This should only include options specific to the
 * provided execution service.
 * @param options.options - The simulation options.
 * @returns The snap.
 * @throws If the built-in server is not running, and no snap ID is provided.
 */
export async function installSnap<
  Service extends new (...args: any[]) => InstanceType<
    typeof AbstractExecutionService
  >,
>(options: Partial<InstallSnapOptions<Service>>): Promise<Snap>;

/**
 * Load a snap into the environment. This is the main entry point for testing
 * snaps: It returns a {@link Snap} object that can be used to interact with the
 * snap.
 *
 * @example
 * import { installSnap } from '@metamask/snaps-jest';
 *
 * describe('My Snap', () => {
 *   it('should do something', async () => {
 *     const { request } = await installSnap('local:my-snap');
 *     const response = await request({
 *       method: 'foo',
 *       params: ['bar'],
 *     });
 *     expect(response).toRespondWith('bar');
 *   });
 * });
 * @param snapId - The ID of the snap, including the prefix (`local:`). Defaults
 * to the URL of the built-in server, if it is running. This supports both
 * local snap IDs and NPM snap IDs.
 * @param options - The options to use.
 * @param options.executionService - The execution service to use. Defaults to
 * {@link NodeThreadExecutionService}. You do not need to provide this unless
 * you are testing a custom execution service.
 * @param options.executionServiceOptions - The options to use when creating the
 * execution service, if any. This should only include options specific to the
 * provided execution service.
 * @param options.options - The simulation options.
 * @returns The snap.
 * @throws If the built-in server is not running, and no snap ID is provided.
 */
export async function installSnap<
  Service extends new (...args: any[]) => InstanceType<
    typeof AbstractExecutionService
  >,
>(
  snapId: SnapId,
  options?: Partial<InstallSnapOptions<Service>>,
): Promise<Snap>;

/**
 * Load a snap into the environment. This is the main entry point for testing
 * snaps: It returns a {@link Snap} object that can be used to interact with the
 * snap.
 *
 * @example
 * import { installSnap } from '@metamask/snaps-jest';
 *
 * describe('My Snap', () => {
 *   it('should do something', async () => {
 *     const { request } = await installSnap('local:my-snap');
 *     const response = await request({
 *       method: 'foo',
 *       params: ['bar'],
 *     });
 *     expect(response).toRespondWith('bar');
 *   });
 * });
 * @param snapId - The ID of the snap, including the prefix (`local:`). Defaults
 * to the URL of the built-in server, if it is running. This supports both
 * local snap IDs and NPM snap IDs.
 * @param options - The options to use.
 * @param options.executionService - The execution service to use. Defaults to
 * {@link NodeThreadExecutionService}. You do not need to provide this unless
 * you are testing a custom execution service.
 * @param options.executionServiceOptions - The options to use when creating the
 * execution service, if any. This should only include options specific to the
 * provided execution service.
 * @param options.options - The simulation options.
 * @returns The snap.
 * @throws If the built-in server is not running, and no snap ID is provided.
 */
export async function installSnap<
  Service extends new (...args: any[]) => InstanceType<
    typeof AbstractExecutionService
  >,
>(
  snapId?: SnapId | Partial<InstallSnapOptions<Service>>,
  options: Partial<InstallSnapOptions<Service>> = {},
): Promise<Snap> {
  const resolvedOptions = getOptions(snapId, options);
  const {
    snapId: installedSnapId,
    store,
    executionService,
    runSaga,
    controllerMessenger,
  } = await getEnvironment().installSnap(...resolvedOptions);

  const onTransaction = async (
    request: TransactionOptions,
  ): Promise<SnapResponseWithInterface> => {
    log('Sending transaction %o.', request);

    const {
      origin: transactionOrigin,
      chainId,
      ...transaction
    } = create(request, TransactionOptionsStruct);

    const response = await handleRequest({
      snapId: installedSnapId,
      store,
      executionService,
      runSaga,
      controllerMessenger,
      handler: HandlerType.OnTransaction,
      request: {
        method: '',
        params: {
          chainId,
          transaction,
          transactionOrigin,
        },
      },
    });

    assertIsResponseWithInterface(response);

    return response;
  };

  const onCronjob = async (request: CronjobOptions) => {
    log('Running cronjob %o.', options);

    return handleRequest({
      snapId: installedSnapId,
      store,
      executionService,
      controllerMessenger,
      runSaga,
      handler: HandlerType.OnCronjob,
      request,
    });
  };

  return {
    request: async (request) => {
      log('Sending request %o.', request);

      return handleRequest({
        snapId: installedSnapId,
        store,
        executionService,
        controllerMessenger,
        runSaga,
        handler: HandlerType.OnRpcRequest,
        request,
      });
    },

    onTransaction,
    sendTransaction: onTransaction,

    onSignature: async (
      request: unknown,
    ): Promise<SnapResponseWithInterface> => {
      log('Requesting signature %o.', request);

      const { origin: signatureOrigin, ...signature } = create(
        request,
        SignatureOptionsStruct,
      );

      const response = await handleRequest({
        snapId: installedSnapId,
        store,
        executionService,
        controllerMessenger,
        runSaga,
        handler: HandlerType.OnSignature,
        request: {
          method: '',
          params: {
            signature,
            signatureOrigin,
          },
        },
      });

      assertIsResponseWithInterface(response);

      return response;
    },

    onCronjob,
    runCronjob: onCronjob,

    onHomePage: async (): Promise<SnapResponseWithInterface> => {
      log('Rendering home page.');

      const response = await handleRequest({
        snapId: installedSnapId,
        store,
        executionService,
        controllerMessenger,
        runSaga,
        handler: HandlerType.OnHomePage,
        request: {
          method: '',
        },
      });

      assertIsResponseWithInterface(response);

      return response;
    },

    mockJsonRpc(mock: JsonRpcMockOptions) {
      log('Mocking JSON-RPC request %o.', mock);

      const { method, result } = create(mock, JsonRpcMockOptionsStruct);
      store.dispatch(addJsonRpcMock({ method, result }));

      return {
        unmock() {
          log('Unmocking JSON-RPC request %o.', mock);

          store.dispatch(removeJsonRpcMock(method));
        },
      };
    },

    close: async () => {
      log('Closing execution service.');
      logInfo(
        'Calling `snap.close()` is deprecated, and will be removed in a future release. Snaps are now automatically closed when the test ends.',
      );

      await executionService.terminateAllSnaps();
    },
  };
}
