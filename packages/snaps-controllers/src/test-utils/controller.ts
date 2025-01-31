import type { ApprovalRequest } from '@metamask/approval-controller';
import type { Messenger, RestrictedMessenger } from '@metamask/base-controller';
import {
  encryptWithKey,
  decryptWithKey,
  keyFromPassword,
  importKey,
  exportKey,
  generateSalt,
  isVaultUpdated,
} from '@metamask/browser-passworder';
import type {
  PermissionConstraint,
  SubjectPermissions,
  ValidPermission,
  Caveat,
  SubjectMetadata,
} from '@metamask/permission-controller';
import { SubjectType } from '@metamask/permission-controller';
import { providerErrors } from '@metamask/rpc-errors';
import {
  SnapEndowments,
  WALLET_SNAP_PERMISSION_KEY,
} from '@metamask/snaps-rpc-methods';
import { text, type SnapId } from '@metamask/snaps-sdk';
import { SnapCaveatType } from '@metamask/snaps-utils';
import {
  MockControllerMessenger,
  getPersistedSnapObject,
  getTruncatedSnap,
  MOCK_LOCAL_SNAP_ID,
  MOCK_ORIGIN,
  MOCK_SNAP_ID,
  TEST_SECRET_RECOVERY_PHRASE_BYTES,
} from '@metamask/snaps-utils/test-utils';
import type { Json } from '@metamask/utils';

import type {
  CronjobControllerActions,
  CronjobControllerEvents,
} from '../cronjob';
import type {
  SnapInsightsControllerAllowedActions,
  SnapInsightsControllerAllowedEvents,
} from '../insights';
import type {
  SnapInterfaceControllerActions,
  SnapInterfaceControllerAllowedActions,
  SnapInterfaceControllerEvents,
  StoredInterface,
} from '../interface/SnapInterfaceController';
import type {
  MultichainRouterActions,
  MultichainRouterAllowedActions,
  MultichainRouterEvents,
} from '../multichain';
import { SnapController } from '../snaps';
import type {
  AllowedActions,
  AllowedEvents,
  PersistedSnapControllerState,
  SnapControllerActions,
  SnapControllerEvents,
  SnapControllerStateChangeEvent,
  SnapsRegistryActions,
  SnapsRegistryEvents,
} from '../snaps';
import type { KeyDerivationOptions } from '../types';
import { MOCK_CRONJOB_PERMISSION } from './cronjob';
import { getNodeEES, getNodeEESMessenger } from './execution-environment';
import { MockSnapsRegistry } from './registry';

const asyncNoOp = async () => Promise.resolve();

/**
 * A controller messenger, that allows overwriting the action handlers, without
 * the need to call `unregisterActionHandler` first.
 */

export class MockApprovalController {
  #approval?: {
    request: Partial<ApprovalRequest<Record<string, Json>>>;
    promise: {
      resolve: (value?: unknown) => void;
      reject: (value?: unknown) => void;
    };
  };

  async addRequest(request: {
    id?: string;
    origin?: string;
    requestData?: Record<string, Json>;
  }) {
    const promise = new Promise((resolve, reject) => {
      this.#approval = {
        promise: { resolve, reject },
        request,
      };
    });

    return promise;
  }

  hasRequest(
    opts: { id?: string; origin?: string; type?: string } = {},
  ): boolean {
    return this.#approval?.request.id === opts.id;
  }

  async acceptRequest(_id: string, value: unknown) {
    if (this.#approval) {
      this.#approval.promise.resolve(value);
      return await Promise.resolve({ value });
    }

    return await Promise.reject(new Error('No request to approve.'));
  }

  updateRequestStateAndApprove({
    requestState,
  }: {
    requestState: Record<string, Json>;
  }) {
    if (this.#approval) {
      if (requestState.loading === false && !requestState.error) {
        this.#approval.promise.resolve({
          permissions: requestState.permissions,
          ...this.#approval.request.requestData,
        });
      }
    }
  }

  updateRequestStateAndReject({
    requestState,
  }: {
    requestState: Record<string, Json>;
  }) {
    if (this.#approval) {
      if (requestState.loading === false && !requestState.error) {
        this.#approval.promise.reject(providerErrors.userRejectedRequest());
      }
    }
  }
}

export const approvalControllerMock = new MockApprovalController();

export const snapDialogPermissionKey = 'snap_dialog';

export const MOCK_INTERFACE_ID = 'QovlAsV2Z3xLP5hsrVMsz';

export const MOCK_SNAP_SUBJECT_METADATA: SubjectMetadata = {
  origin: MOCK_SNAP_ID,
  subjectType: SubjectType.Snap,
  name: 'foo',
  extensionId: 'bar',
  iconUrl: 'baz',
};

export const MOCK_DAPP_SUBJECT_METADATA: SubjectMetadata = {
  origin: MOCK_ORIGIN,
  subjectType: SubjectType.Website,
  name: 'foo',
  extensionId: 'bar',
  iconUrl: 'baz',
};

export const MOCK_RPC_ORIGINS_PERMISSION: PermissionConstraint = {
  caveats: [
    { type: SnapCaveatType.RpcOrigin, value: { snaps: true, dapps: false } },
  ],
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: SnapEndowments.Rpc,
};

export const MOCK_LIFECYCLE_HOOKS_PERMISSION: PermissionConstraint = {
  caveats: null,
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: SnapEndowments.LifecycleHooks,
};

export const MOCK_KEYRING_ORIGINS_PERMISSION: PermissionConstraint = {
  caveats: [
    { type: SnapCaveatType.KeyringOrigin, value: { allowedOrigins: [] } },
  ],
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: SnapEndowments.Keyring,
};

export const MOCK_DAPPS_RPC_ORIGINS_PERMISSION: PermissionConstraint = {
  caveats: [
    { type: SnapCaveatType.RpcOrigin, value: { snaps: false, dapps: true } },
  ],
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: SnapEndowments.Rpc,
};

export const MOCK_ALLOWED_RPC_ORIGINS_PERMISSION: PermissionConstraint = {
  caveats: [
    {
      type: SnapCaveatType.RpcOrigin,
      value: { allowedOrigins: ['https://metamask.io'] },
    },
  ],
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: SnapEndowments.Rpc,
};

export const MOCK_SNAP_DIALOG_PERMISSION: PermissionConstraint = {
  caveats: null,
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_SNAP_ID,
  parentCapability: snapDialogPermissionKey,
};

export const MOCK_WALLET_SNAP_PERMISSION: PermissionConstraint = {
  caveats: [
    {
      type: SnapCaveatType.SnapIds,
      value: {
        [MOCK_SNAP_ID]: {},
        [MOCK_LOCAL_SNAP_ID]: {},
        [`${MOCK_SNAP_ID}1`]: {},
        [`${MOCK_SNAP_ID}2`]: {},
        [`${MOCK_SNAP_ID}3`]: {},
      },
    },
  ],
  date: 1664187844588,
  id: 'izn0WGUO8cvq_jqvLQuQP',
  invoker: MOCK_ORIGIN,
  parentCapability: WALLET_SNAP_PERMISSION_KEY,
};

export const MOCK_ORIGIN_PERMISSIONS: Record<string, PermissionConstraint> = {
  [WALLET_SNAP_PERMISSION_KEY]: MOCK_WALLET_SNAP_PERMISSION,
};

export const MOCK_SNAP_PERMISSIONS: Record<string, PermissionConstraint> = {
  [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
  [snapDialogPermissionKey]: MOCK_SNAP_DIALOG_PERMISSION,
};

export const MOCK_INSIGHTS_PERMISSIONS: Record<string, PermissionConstraint> = {
  [SnapEndowments.TransactionInsight]: {
    caveats: [
      {
        type: SnapCaveatType.TransactionOrigin,
        value: true,
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.TransactionInsight,
  },
  [SnapEndowments.SignatureInsight]: {
    caveats: [
      {
        type: SnapCaveatType.SignatureOrigin,
        value: true,
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.SignatureInsight,
  },
};

export const MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS: Record<
  string,
  PermissionConstraint
> = {
  [SnapEndowments.TransactionInsight]: {
    caveats: [
      {
        type: SnapCaveatType.TransactionOrigin,
        value: false,
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.TransactionInsight,
  },
  [SnapEndowments.SignatureInsight]: {
    caveats: [
      {
        type: SnapCaveatType.SignatureOrigin,
        value: false,
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.SignatureInsight,
  },
};

export const getControllerMessenger = (registry = new MockSnapsRegistry()) => {
  const messenger = new MockControllerMessenger<
    SnapControllerActions | AllowedActions,
    SnapControllerEvents | AllowedEvents
  >();

  messenger.registerActionHandler('PermissionController:hasPermission', () => {
    return true;
  });

  messenger.registerActionHandler('PermissionController:hasPermissions', () => {
    return true;
  });

  messenger.registerActionHandler(
    'ApprovalController:addRequest',
    approvalControllerMock.addRequest.bind(approvalControllerMock),
  );

  messenger.registerActionHandler(
    'ApprovalController:updateRequestState',
    approvalControllerMock.updateRequestStateAndApprove.bind(
      approvalControllerMock,
    ),
  );

  messenger.registerActionHandler(
    'PermissionController:getEndowments',
    async () => {
      return Promise.resolve(['ethereum']);
    },
  );

  messenger.registerActionHandler(
    'PermissionController:grantPermissions',
    () => ({}),
  );

  messenger.registerActionHandler(
    'PermissionController:revokePermissions',
    () => ({}),
  );

  messenger.registerActionHandler(
    'PermissionController:revokeAllPermissions',
    () => ({}),
  );

  messenger.registerActionHandler(
    'PermissionController:revokePermissionForAllSubjects',
    () => ({}),
  );

  messenger.registerActionHandler(
    'PermissionController:getPermissions',
    (
      origin,
    ): SubjectPermissions<
      ValidPermission<string, Caveat<string, Json> | Caveat<string, any>>
    > => {
      if (origin === MOCK_SNAP_ID) {
        return MOCK_SNAP_PERMISSIONS;
      }
      return MOCK_ORIGIN_PERMISSIONS;
    },
  );

  messenger.registerActionHandler(
    'PermissionController:getSubjectNames',
    () => [MOCK_ORIGIN],
  );

  messenger.registerActionHandler(
    'PermissionController:updateCaveat',
    () => undefined,
  );

  messenger.registerActionHandler(
    'SubjectMetadataController:getSubjectMetadata',
    () => MOCK_SNAP_SUBJECT_METADATA,
  );

  messenger.registerActionHandler(
    'SubjectMetadataController:addSubjectMetadata',
    () => undefined,
  );

  messenger.registerActionHandler('ExecutionService:executeSnap', asyncNoOp);
  messenger.registerActionHandler(
    'ExecutionService:handleRpcRequest',
    asyncNoOp,
  );
  messenger.registerActionHandler('ExecutionService:terminateSnap', asyncNoOp);
  messenger.registerActionHandler(
    'ExecutionService:terminateAllSnaps',
    asyncNoOp,
  );

  messenger.registerActionHandler(
    'SnapsRegistry:get',
    registry.get.bind(registry),
  );
  messenger.registerActionHandler(
    'SnapsRegistry:getMetadata',
    registry.getMetadata.bind(registry),
  );
  messenger.registerActionHandler(
    'SnapsRegistry:resolveVersion',
    registry.resolveVersion.bind(registry),
  );

  messenger.registerActionHandler(
    'SnapsRegistry:update',
    registry.update.bind(registry),
  );

  messenger.registerActionHandler(
    'SnapInterfaceController:createInterface',
    async () => MOCK_INTERFACE_ID,
  );

  messenger.registerActionHandler(
    'SnapInterfaceController:getInterface',
    (snapId, id) => {
      if (id !== MOCK_INTERFACE_ID) {
        throw new Error(`Interface with id '${id}' not found.`);
      }
      return { snapId, content: text('foo bar'), state: {} } as StoredInterface;
    },
  );

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getSnapControllerMessenger = (
  messenger: ReturnType<
    typeof getControllerMessenger
  > = getControllerMessenger(),
) => {
  const snapControllerMessenger = messenger.getRestricted<
    'SnapController',
    SnapControllerActions['type'] | AllowedActions['type'],
    SnapControllerEvents['type'] | AllowedEvents['type']
  >({
    name: 'SnapController',
    allowedEvents: [
      'ExecutionService:unhandledError',
      'ExecutionService:outboundRequest',
      'ExecutionService:outboundResponse',
      'SnapController:snapAdded',
      'SnapController:snapBlocked',
      'SnapController:snapInstalled',
      'SnapController:snapUninstalled',
      'SnapController:snapUnblocked',
      'SnapController:snapUpdated',
      'SnapController:stateChange',
      'SnapController:snapRolledback',
      'KeyringController:lock',
    ],
    allowedActions: [
      'ApprovalController:addRequest',
      'ApprovalController:updateRequestState',
      'ExecutionService:executeSnap',
      'ExecutionService:terminateAllSnaps',
      'ExecutionService:terminateSnap',
      'ExecutionService:handleRpcRequest',
      'PermissionController:getEndowments',
      'PermissionController:hasPermission',
      'PermissionController:hasPermissions',
      'PermissionController:getPermissions',
      'PermissionController:grantPermissions',
      'PermissionController:revokePermissions',
      'PermissionController:revokeAllPermissions',
      'PermissionController:revokePermissionForAllSubjects',
      'PermissionController:updateCaveat',
      'PermissionController:getSubjectNames',
      'PhishingController:maybeUpdateState',
      'PhishingController:testOrigin',
      'SnapController:get',
      'SnapController:handleRequest',
      'SnapController:getSnapState',
      'SnapController:has',
      'SnapController:updateSnapState',
      'SnapController:clearSnapState',
      'SnapController:updateBlockedSnaps',
      'SnapController:enable',
      'SnapController:disable',
      'SnapController:remove',
      'SnapController:getAll',
      'SnapController:getRunnableSnaps',
      'SnapController:getPermitted',
      'SnapController:install',
      'SnapController:incrementActiveReferences',
      'SnapController:decrementActiveReferences',
      'SnapController:getRegistryMetadata',
      'SubjectMetadataController:getSubjectMetadata',
      'SubjectMetadataController:addSubjectMetadata',
      'SnapsRegistry:get',
      'SnapsRegistry:getMetadata',
      'SnapsRegistry:update',
      'SnapController:disconnectOrigin',
      'SnapController:revokeDynamicPermissions',
      'SnapController:getFile',
      'SnapsRegistry:resolveVersion',
      'SnapInterfaceController:createInterface',
      'SnapInterfaceController:getInterface',
    ],
  });

  jest.spyOn(snapControllerMessenger, 'call');
  jest.spyOn(snapControllerMessenger, 'publish');

  return snapControllerMessenger;
};

export type SnapControllerConstructorParams = ConstructorParameters<
  typeof SnapController
>[0];

export type PartialSnapControllerConstructorParams = Partial<
  Omit<ConstructorParameters<typeof SnapController>[0], 'state'> & {
    state: Partial<SnapControllerConstructorParams['state']>;
  }
>;

export const DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS = {
  algorithm: 'PBKDF2' as const,
  params: {
    iterations: 600_000,
  },
};

export const getSnapControllerEncryptor = () => {
  return {
    encryptWithKey,
    decryptWithKey,
    keyFromPassword: async (
      password: string,
      salt: string,
      exportable: boolean,
      opts?: KeyDerivationOptions,
    ) =>
      keyFromPassword(
        password,
        salt,
        exportable,
        opts ?? DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      ),
    importKey,
    exportKey,
    generateSalt,
    isVaultUpdated: (vault: string) =>
      isVaultUpdated(vault, DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS),
  };
};

export const getSnapControllerOptions = (
  opts?: PartialSnapControllerConstructorParams,
) => {
  const options = {
    environmentEndowmentPermissions: [],
    closeAllConnections: jest.fn(),
    messenger: getSnapControllerMessenger(),
    featureFlags: {
      dappsCanUpdateSnaps: true,
      rejectInvalidPlatformVersion: true,
    },
    state: undefined,
    fetchFunction: jest.fn(),
    getMnemonic: async () => Promise.resolve(TEST_SECRET_RECOVERY_PHRASE_BYTES),
    clientCryptography: {},
    encryptor: getSnapControllerEncryptor(),
    ...opts,
  } as SnapControllerConstructorParams;

  options.state = {
    snaps: {},
    snapStates: {},
    unencryptedSnapStates: {},
    ...options.state,
  };
  return options;
};

export type GetSnapControllerWithEESOptionsParam = Omit<
  PartialSnapControllerConstructorParams,
  'messenger'
> & { rootMessenger?: ReturnType<typeof getControllerMessenger> };

export const getSnapControllerWithEESOptions = ({
  rootMessenger = getControllerMessenger(),
  ...options
}: GetSnapControllerWithEESOptionsParam = {}) => {
  const snapControllerMessenger = getSnapControllerMessenger(rootMessenger);

  return {
    featureFlags: { dappsCanUpdateSnaps: true },
    environmentEndowmentPermissions: [],
    closeAllConnections: jest.fn(),
    messenger: snapControllerMessenger,
    rootMessenger,
    getMnemonic: async () => Promise.resolve(TEST_SECRET_RECOVERY_PHRASE_BYTES),
    encryptor: getSnapControllerEncryptor(),
    fetchFunction: jest.fn(),
    ...options,
  } as SnapControllerConstructorParams & {
    rootMessenger: ReturnType<typeof getControllerMessenger>;
  };
};

export const getSnapController = (options = getSnapControllerOptions()) => {
  return new SnapController(options);
};

export const getSnapControllerWithEES = (
  options = getSnapControllerWithEESOptions(),
  service?: ReturnType<typeof getNodeEES>,
) => {
  const _service =
    service ?? getNodeEES(getNodeEESMessenger(options.rootMessenger));

  const controller = new SnapController(options);
  return [controller, _service] as const;
};

export const getPersistedSnapsState = (
  ...snaps: PersistedSnapControllerState['snaps'][SnapId][]
): PersistedSnapControllerState['snaps'] => {
  return (snaps.length > 0 ? snaps : [getPersistedSnapObject()]).reduce<
    PersistedSnapControllerState['snaps']
  >((snapsState, snapObject) => {
    snapsState[snapObject.id] = snapObject;
    return snapsState;
  }, {});
};

// Mock controller messenger for Cronjob Controller
export const getRootCronjobControllerMessenger = () => {
  const messenger = new MockControllerMessenger<
    CronjobControllerActions | AllowedActions,
    CronjobControllerEvents | AllowedEvents
  >();

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getRestrictedCronjobControllerMessenger = (
  messenger: ReturnType<
    typeof getRootCronjobControllerMessenger
  > = getRootCronjobControllerMessenger(),
  mocked = true,
) => {
  const cronjobControllerMessenger = messenger.getRestricted<
    'CronjobController',
    CronjobControllerActions['type'] | AllowedActions['type'],
    CronjobControllerEvents['type'] | AllowedEvents['type']
  >({
    name: 'CronjobController',
    allowedEvents: [
      'SnapController:snapInstalled',
      'SnapController:snapUpdated',
      'SnapController:snapUninstalled',
      'SnapController:snapEnabled',
      'SnapController:snapDisabled',
    ],
    allowedActions: [
      'PermissionController:hasPermission',
      'PermissionController:getPermissions',
      'SnapController:getAll',
      'SnapController:handleRequest',
      'CronjobController:scheduleBackgroundEvent',
      'CronjobController:cancelBackgroundEvent',
      'CronjobController:getBackgroundEvents',
    ],
  });

  if (mocked) {
    messenger.registerActionHandler(
      'PermissionController:hasPermission',
      () => {
        return true;
      },
    );

    messenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return { [SnapEndowments.Cronjob]: MOCK_CRONJOB_PERMISSION };
      },
    );

    messenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap()];
    });

    messenger.registerActionHandler('SnapController:handleRequest', asyncNoOp);
  }

  return cronjobControllerMessenger;
};

// Mock controller messenger for registry
export const getRootSnapsRegistryControllerMessenger = () => {
  const messenger = new MockControllerMessenger<
    SnapsRegistryActions,
    SnapsRegistryEvents
  >();

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getRestrictedSnapsRegistryControllerMessenger = (
  messenger: ReturnType<
    typeof getRootSnapsRegistryControllerMessenger
  > = getRootSnapsRegistryControllerMessenger(),
) => {
  const controllerMessenger = messenger.getRestricted<
    'SnapsRegistry',
    SnapsRegistryActions['type'],
    SnapsRegistryEvents['type']
  >({
    name: 'SnapsRegistry',
    allowedEvents: [],
    allowedActions: [
      'SnapsRegistry:get',
      'SnapsRegistry:getMetadata',
      'SnapsRegistry:update',
      'SnapsRegistry:resolveVersion',
    ],
  });

  return controllerMessenger;
};

// Mock controller messenger for Interface Controller
export const getRootSnapInterfaceControllerMessenger = () => {
  const messenger = new MockControllerMessenger<
    SnapInterfaceControllerActions | SnapInterfaceControllerAllowedActions,
    SnapInterfaceControllerEvents
  >();

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getRestrictedSnapInterfaceControllerMessenger = (
  messenger: ReturnType<
    typeof getRootSnapInterfaceControllerMessenger
  > = getRootSnapInterfaceControllerMessenger(),
  mocked = true,
) => {
  const snapInterfaceControllerMessenger = messenger.getRestricted<
    'SnapInterfaceController',
    SnapInterfaceControllerAllowedActions['type'],
    SnapInterfaceControllerEvents['type']
  >({
    name: 'SnapInterfaceController',
    allowedActions: [
      'PhishingController:testOrigin',
      'PhishingController:maybeUpdateState',
      'ApprovalController:hasRequest',
      'ApprovalController:acceptRequest',
    ],
    allowedEvents: [
      'NotificationServicesController:notificationsListUpdated',
      'SnapInterfaceController:stateChange',
    ],
  });

  if (mocked) {
    messenger.registerActionHandler(
      'PhishingController:maybeUpdateState',
      async () => Promise.resolve(),
    );

    messenger.registerActionHandler('PhishingController:testOrigin', () => ({
      result: false,
      type: 'all',
    }));
  }

  return snapInterfaceControllerMessenger;
};

// Mock controller messenger for Insight Controller
export const getRootSnapInsightsControllerMessenger = () => {
  const messenger = new MockControllerMessenger<
    SnapInsightsControllerAllowedActions,
    SnapInsightsControllerAllowedEvents
  >();

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getRestrictedSnapInsightsControllerMessenger = (
  messenger: ReturnType<
    typeof getRootSnapInsightsControllerMessenger
  > = getRootSnapInsightsControllerMessenger(),
) => {
  const controllerMessenger = messenger.getRestricted<
    'SnapInsightsController',
    SnapInsightsControllerAllowedActions['type'],
    SnapInsightsControllerAllowedEvents['type']
  >({
    name: 'SnapInsightsController',
    allowedEvents: [
      'TransactionController:unapprovedTransactionAdded',
      'TransactionController:transactionStatusUpdated',
      'SignatureController:stateChange',
    ],
    allowedActions: [
      'PermissionController:getPermissions',
      'SnapController:getAll',
      'SnapController:handleRequest',
      'SnapInterfaceController:deleteInterface',
    ],
  });

  return controllerMessenger;
};

/**
 * Wait for the state change event to be emitted by the messenger.
 *
 * @param messenger - The messenger to listen to.
 * @returns A promise that resolves when the state change event is emitted.
 */
export async function waitForStateChange(
  messenger:
    | Messenger<any, SnapControllerStateChangeEvent>
    | RestrictedMessenger<
        'SnapController',
        any,
        SnapControllerStateChangeEvent,
        any,
        'SnapController:stateChange'
      >,
) {
  return new Promise<void>((resolve) => {
    messenger.subscribe('SnapController:stateChange', () => {
      resolve();
    });
  });
}

// Mock controller messenger for Multichain Router
export const getRootMultichainRouterMessenger = () => {
  const messenger = new MockControllerMessenger<
    MultichainRouterActions | MultichainRouterAllowedActions,
    MultichainRouterEvents
  >();

  jest.spyOn(messenger, 'call');

  return messenger;
};

export const getRestrictedMultichainRouterMessenger = (
  messenger: ReturnType<
    typeof getRootMultichainRouterMessenger
  > = getRootMultichainRouterMessenger(),
) => {
  const controllerMessenger = messenger.getRestricted<
    'MultichainRouter',
    MultichainRouterAllowedActions['type'],
    never
  >({
    name: 'MultichainRouter',
    allowedEvents: [],
    allowedActions: [
      'PermissionController:getPermissions',
      'SnapController:getAll',
      'SnapController:handleRequest',
      'AccountsController:listMultichainAccounts',
    ],
  });

  return controllerMessenger;
};
