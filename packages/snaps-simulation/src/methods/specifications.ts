import type { GenericPermissionController } from '@metamask/permission-controller';
import {
  endowmentPermissionBuilders,
  buildSnapEndowmentSpecifications,
  buildSnapRestrictedMethodSpecifications,
} from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import { DEFAULT_ENDOWMENTS } from '@metamask/snaps-utils';

import type { RootControllerMessenger } from '../controllers';
import type { SimulationOptions } from '../options';
import type { RunSagaFunction } from '../store';
import {
  EXCLUDED_SNAP_ENDOWMENTS,
  EXCLUDED_SNAP_PERMISSIONS,
} from './constants';
import {
  getGetPreferencesMethodImplementation,
  getClearSnapStateMethodImplementation,
  getGetSnapStateMethodImplementation,
  getUpdateSnapStateMethodImplementation,
  getShowInAppNotificationImplementation,
  getShowNativeNotificationImplementation,
  getCreateInterfaceImplementation,
  getGetInterfaceImplementation,
  getRequestUserApprovalImplementation,
} from './hooks';

export type PermissionSpecificationsHooks = {
  /**
   * A hook that returns the user's secret recovery phrase.
   *
   * @param keyringId - The ID of the keyring to get the mnemonic for.
   * @returns The user's secret recovery phrase.
   */
  getMnemonic: (keyringId?: string) => Promise<Uint8Array>;
};

export type GetPermissionSpecificationsOptions = {
  controllerMessenger: RootControllerMessenger;
  hooks: PermissionSpecificationsHooks;
  runSaga: RunSagaFunction;
  options: SimulationOptions;
};

/**
 * Get a function which resolves with the specified result.
 *
 * @param result - The result to return.
 * @returns The function implementation.
 */
export function resolve(result: unknown) {
  return () => result;
}

/**
 * Get a function which resolves with the specified result.
 *
 * @param result - The result to return. If not specified, the function will
 * resolve with `undefined`.
 * @returns The function implementation.
 */
export function asyncResolve<Type>(result?: Type) {
  return async () => result;
}

/**
 * Get the permission specifications for the Snap.
 *
 * @param options - The options.
 * @param options.controllerMessenger - The controller messenger.
 * @param options.hooks - The hooks.
 * @param options.runSaga - The function to run a saga outside the usual Redux
 * flow.
 * @param options.options - The simulation options.
 * @returns The permission specifications for the Snap.
 */
export function getPermissionSpecifications({
  controllerMessenger,
  hooks,
  runSaga,
  options,
}: GetPermissionSpecificationsOptions) {
  return {
    ...buildSnapEndowmentSpecifications(EXCLUDED_SNAP_ENDOWMENTS),
    ...buildSnapRestrictedMethodSpecifications(EXCLUDED_SNAP_PERMISSIONS, {
      // Shared hooks.
      ...hooks,

      // Snaps-specific hooks.
      clearSnapState: getClearSnapStateMethodImplementation(runSaga),
      getPreferences: getGetPreferencesMethodImplementation(options),
      getSnapState: getGetSnapStateMethodImplementation(runSaga),
      getUnlockPromise: asyncResolve(true),

      // TODO: Allow the user to specify the result of this function.
      isOnPhishingList: resolve(false),

      maybeUpdatePhishingList: asyncResolve(),
      requestUserApproval: getRequestUserApprovalImplementation(runSaga),
      showInAppNotification: getShowInAppNotificationImplementation(runSaga),
      showNativeNotification: getShowNativeNotificationImplementation(runSaga),
      updateSnapState: getUpdateSnapStateMethodImplementation(runSaga),
      createInterface: getCreateInterfaceImplementation(controllerMessenger),
      getInterface: getGetInterfaceImplementation(controllerMessenger),
    }),
  };
}

/**
 * Get the endowments for the Snap.
 *
 * @param permissionController - The permission controller.
 * @param snapId - The ID of the Snap.
 * @returns The endowments for the Snap.
 */
export async function getEndowments(
  permissionController: GenericPermissionController,
  snapId: SnapId,
) {
  const allEndowments = await Object.keys(endowmentPermissionBuilders).reduce<
    Promise<string[]>
  >(async (promise, permissionName) => {
    const accumulator = await promise;
    if (permissionController.hasPermission(snapId, permissionName)) {
      const endowments = await permissionController.getEndowments(
        snapId,
        permissionName,
      );

      if (endowments) {
        return accumulator.concat(endowments as string[]);
      }
    }

    return accumulator;
  }, Promise.resolve([]));

  return [...new Set([...DEFAULT_ENDOWMENTS, ...allEndowments])];
}
