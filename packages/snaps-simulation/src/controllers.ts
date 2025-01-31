import type { Messenger } from '@metamask/base-controller';
import type {
  CaveatSpecificationConstraint,
  PermissionSpecificationConstraint,
  PermissionControllerActions,
  SubjectMetadataControllerActions,
} from '@metamask/permission-controller';
import {
  PermissionController,
  SubjectMetadataController,
  SubjectType,
} from '@metamask/permission-controller';
import { SnapInterfaceController } from '@metamask/snaps-controllers';
import type {
  ExecutionServiceActions,
  SnapInterfaceControllerActions,
  SnapInterfaceControllerAllowedActions,
  SnapInterfaceControllerStateChangeEvent,
} from '@metamask/snaps-controllers';
import {
  caveatSpecifications as snapsCaveatsSpecifications,
  endowmentCaveatSpecifications as snapsEndowmentCaveatSpecifications,
  processSnapPermissions,
} from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import type { SnapManifest } from '@metamask/snaps-utils';
import { getSafeJson } from '@metamask/utils';

import { getPermissionSpecifications } from './methods';
import { UNRESTRICTED_METHODS } from './methods/constants';
import type { SimulationOptions } from './options';
import type { RestrictedMiddlewareHooks } from './simulation';
import type { RunSagaFunction } from './store';

export type RootControllerAllowedActions =
  | SnapInterfaceControllerActions
  | SnapInterfaceControllerAllowedActions
  | PermissionControllerActions
  | ExecutionServiceActions
  | SubjectMetadataControllerActions;

export type RootControllerAllowedEvents =
  SnapInterfaceControllerStateChangeEvent;

export type RootControllerMessenger = Messenger<
  RootControllerAllowedActions,
  RootControllerAllowedEvents
>;

export type GetControllersOptions = {
  controllerMessenger: Messenger<any, any>;
  hooks: RestrictedMiddlewareHooks;
  runSaga: RunSagaFunction;
  options: SimulationOptions;
};

export type Controllers = {
  permissionController: PermissionController<
    PermissionSpecificationConstraint,
    CaveatSpecificationConstraint
  >;
  subjectMetadataController: SubjectMetadataController;
  interfaceController: SnapInterfaceController;
};

/**
 * Get the controllers for the Snap.
 *
 * @param options - The options.
 * @returns The controllers for the Snap.
 */
export function getControllers(options: GetControllersOptions): Controllers {
  const { controllerMessenger } = options;
  const subjectMetadataController = new SubjectMetadataController({
    messenger: controllerMessenger.getRestricted({
      name: 'SubjectMetadataController',
      allowedActions: [],
      allowedEvents: [],
    }),
    subjectCacheLimit: 100,
  });

  const interfaceController = new SnapInterfaceController({
    messenger: controllerMessenger.getRestricted({
      name: 'SnapInterfaceController',
      allowedActions: [
        'PhishingController:maybeUpdateState',
        'PhishingController:testOrigin',
        'ApprovalController:hasRequest',
        'ApprovalController:acceptRequest',
      ],
      allowedEvents: [
        'NotificationServicesController:notificationsListUpdated',
      ],
    }),
  });

  const permissionController = getPermissionController(options);

  return {
    permissionController,
    subjectMetadataController,
    interfaceController,
  };
}

/**
 * Get the permission controller for the Snap.
 *
 * @param options - The options.
 * @param options.controllerMessenger - The controller messenger.
 * @param options.options - Miscellaneous options.
 * @returns The permission controller for the Snap.
 */
function getPermissionController(options: GetControllersOptions) {
  const { controllerMessenger } = options;
  const permissionSpecifications = getPermissionSpecifications(options);
  return new PermissionController({
    messenger: controllerMessenger.getRestricted({
      name: 'PermissionController',
      allowedActions: [
        `ApprovalController:addRequest`,
        `ApprovalController:hasRequest`,
        `ApprovalController:acceptRequest`,
        `ApprovalController:rejectRequest`,
        `SnapController:getPermitted`,
        `SnapController:install`,
        `SubjectMetadataController:getSubjectMetadata`,
      ],
      allowedEvents: [],
    }),
    caveatSpecifications: {
      ...snapsCaveatsSpecifications,
      ...snapsEndowmentCaveatSpecifications,
    },
    permissionSpecifications,
    unrestrictedMethods: UNRESTRICTED_METHODS,
  });
}

/**
 * Register the Snap. This sets up the Snap's permissions and subject metadata.
 *
 * @param snapId - The ID of the Snap to install.
 * @param manifest - The parsed manifest.
 * @param controllers - The controllers for the Snap.
 * @param controllers.permissionController - The permission controller.
 * @param controllers.subjectMetadataController - The subject metadata controller.
 */
export async function registerSnap(
  snapId: SnapId,
  manifest: SnapManifest,
  {
    permissionController,
    subjectMetadataController,
  }: Omit<Controllers, 'interfaceController'>,
) {
  subjectMetadataController.addSubjectMetadata({
    origin: snapId,
    subjectType: SubjectType.Snap,
  });

  const approvedPermissions = processSnapPermissions(
    getSafeJson(manifest.initialPermissions),
  );

  permissionController.grantPermissions({
    approvedPermissions,
    subject: { origin: snapId },
    preserveExistingPermissions: false,
  });
}
