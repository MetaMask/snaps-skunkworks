import { getPersistentState } from '@metamask/base-controller';
import { encrypt } from '@metamask/browser-passworder';
import {
  createAsyncMiddleware,
  JsonRpcEngine,
} from '@metamask/json-rpc-engine';
import { createEngineStream } from '@metamask/json-rpc-middleware-stream';
import type { PermissionConstraint } from '@metamask/permission-controller';
import {
  SubjectType,
  type Caveat,
  type SubjectPermissions,
  type ValidPermission,
} from '@metamask/permission-controller';
import { providerErrors, rpcErrors } from '@metamask/rpc-errors';
import {
  WALLET_SNAP_PERMISSION_KEY,
  handlerEndowments,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import { AuxiliaryFileEncoding, text } from '@metamask/snaps-sdk';
import { Text } from '@metamask/snaps-sdk/jsx';
import type { SnapPermissions, RpcOrigins } from '@metamask/snaps-utils';
import {
  getPlatformVersion,
  DEFAULT_ENDOWMENTS,
  DEFAULT_REQUESTED_SNAP_VERSION,
  getLocalizedSnapManifest,
  getSnapChecksum,
  HandlerType,
  logError,
  SnapCaveatType,
  SnapStatus,
  VirtualFile,
} from '@metamask/snaps-utils';
import {
  DEFAULT_SNAP_BUNDLE,
  DEFAULT_SNAP_ICON,
  DEFAULT_SNAP_SHASUM,
  getMockSnapData,
  getPersistedSnapObject,
  getMockSnapFiles,
  getSnapManifest,
  getSnapObject,
  getTruncatedSnap,
  MOCK_LOCAL_SNAP_ID,
  MOCK_ORIGIN,
  MOCK_SNAP_ID,
  getMockLocalizationFile,
  getMockSnapFilesWithUpdatedChecksum,
  MOCK_SNAP_NAME,
  DEFAULT_SOURCE_PATH,
  DEFAULT_ICON_PATH,
  TEST_SECRET_RECOVERY_PHRASE_BYTES,
} from '@metamask/snaps-utils/test-utils';
import type { SemVerRange, SemVerVersion, Json } from '@metamask/utils';
import {
  hexToBytes,
  assert,
  AssertionError,
  base64ToBytes,
  stringToBytes,
  createDeferredPromise,
} from '@metamask/utils';
import { File } from 'buffer';
import { webcrypto } from 'crypto';
import fetchMock from 'jest-fetch-mock';
import { pipeline } from 'readable-stream';
import type { Duplex } from 'readable-stream';
import semver from 'semver';

import { setupMultiplex } from '../services';
import type { NodeThreadExecutionService } from '../services/node';
import {
  approvalControllerMock,
  DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
  ExecutionEnvironmentStub,
  getControllerMessenger,
  getNodeEESMessenger,
  getPersistedSnapsState,
  getSnapController,
  getSnapControllerEncryptor,
  getSnapControllerMessenger,
  getSnapControllerOptions,
  getSnapControllerWithEES,
  getSnapControllerWithEESOptions,
  loopbackDetect,
  LoopbackLocation,
  MOCK_BLOCK_NUMBER,
  MOCK_DAPP_SUBJECT_METADATA,
  MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
  MOCK_INTERFACE_ID,
  MOCK_KEYRING_ORIGINS_PERMISSION,
  MOCK_LIFECYCLE_HOOKS_PERMISSION,
  MOCK_ORIGIN_PERMISSIONS,
  MOCK_RPC_ORIGINS_PERMISSION,
  MOCK_SNAP_PERMISSIONS,
  MOCK_SNAP_SUBJECT_METADATA,
  MOCK_WALLET_SNAP_PERMISSION,
  MockSnapsRegistry,
  sleep,
  waitForStateChange,
} from '../test-utils';
import { delay } from '../utils';
import {
  LEGACY_ENCRYPTION_KEY_DERIVATION_OPTIONS,
  PERMITTED_CHAINS_ENDOWMENT,
} from './constants';
import { SnapsRegistryStatus } from './registry';
import type { SnapControllerState } from './SnapController';
import {
  SNAP_APPROVAL_INSTALL,
  SNAP_APPROVAL_RESULT,
  SNAP_APPROVAL_UPDATE,
} from './SnapController';

if (!('CryptoKey' in globalThis)) {
  // We can remove this once we drop Node 18
  Object.defineProperty(globalThis, 'CryptoKey', {
    value: webcrypto.CryptoKey,
  });
}

globalThis.crypto ??= webcrypto as typeof globalThis.crypto;
globalThis.crypto.getRandomValues = <Type extends ArrayBufferView | null>(
  array: Type,
) => {
  if (array === null) {
    return null as Type;
  }

  return new Uint8Array(array.buffer).fill(0) as unknown as Type;
};

fetchMock.enableMocks();

// Encryption key for `MOCK_SNAP_ID`.
const ENCRYPTION_KEY =
  '0xd2f0a8e994b871ba4451ac383bf323cdaad8d554736355f2223e155692fbc446';

// Encryption key for `MOCK_LOCAL_SNAP_ID`.
const OTHER_ENCRYPTION_KEY =
  '0x7cd340349a41e0f7af62a9d97c76e96b12485e0206791d6b5638dd59736af8f5';

describe('SnapController', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/require-await
    fetchMock.mockImplementation(async () => {
      throw new AssertionError({ message: 'Unmocked access to internet.' });
    });
  });

  it('creates a snap controller and execution service', async () => {
    const [snapController, service] = getSnapControllerWithEES();
    expect(service).toBeDefined();
    expect(snapController).toBeDefined();
    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('adds a snap and uses its JSON-RPC api with a NodeThreadExecutionService', async () => {
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);
    await snapController.startSnap(snap.id);

    const result = await snapController.handleRequest({
      snapId: snap.id,
      origin: MOCK_ORIGIN,
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    expect(result).toBe('test1');
    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('adds a snap and uses its JSON-RPC API', async () => {
    const rootMessenger = getControllerMessenger();
    const executionEnvironmentStub = new ExecutionEnvironmentStub(
      getNodeEESMessenger(rootMessenger),
    ) as unknown as NodeThreadExecutionService;

    const [snapController] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        rootMessenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
      executionEnvironmentStub,
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);
    await snapController.startSnap(snap.id);

    const result = await snapController.handleRequest({
      snapId: snap.id,
      origin: MOCK_ORIGIN,
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    expect(result).toBe('test1');
    snapController.destroy();
  });

  it('passes endowments to a snap when executing it', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        environmentEndowmentPermissions: ['endowment:foo'],
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getEndowments',
      async () => {
        return Promise.resolve(['fooEndowment']);
      },
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    await snapController.startSnap(snap.id);

    expect(messenger.call).toHaveBeenCalledTimes(3);
    expect(messenger.call).toHaveBeenNthCalledWith(
      1,
      'PermissionController:hasPermission',
      MOCK_SNAP_ID,
      'endowment:foo',
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      2,
      'PermissionController:getEndowments',
      MOCK_SNAP_ID,
      'endowment:foo',
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      3,
      'ExecutionService:executeSnap',
      {
        snapId: MOCK_SNAP_ID,
        sourceCode: DEFAULT_SNAP_BUNDLE,
        endowments: [...DEFAULT_ENDOWMENTS, 'fooEndowment'],
      },
    );
    snapController.destroy();
  });

  it('errors if attempting to start a snap that was already started', async () => {
    const messenger = getSnapControllerMessenger();
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    await snapController.startSnap(MOCK_SNAP_ID);
    await expect(snapController.startSnap(MOCK_SNAP_ID)).rejects.toThrow(
      `Snap "${MOCK_SNAP_ID}" is already started.`,
    );

    expect(messenger.call).toHaveBeenCalledTimes(1);
    expect(messenger.call).toHaveBeenNthCalledWith(
      1,
      'ExecutionService:executeSnap',
      {
        snapId: MOCK_SNAP_ID,
        sourceCode: DEFAULT_SNAP_BUNDLE,
        endowments: [...DEFAULT_ENDOWMENTS],
      },
    );

    snapController.destroy();
  });

  it('can rehydrate state', async () => {
    const id = 'npm:foo' as SnapId;
    const firstSnapController = getSnapController(
      getSnapControllerOptions({
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({
              version: '0.0.1',
              sourceCode: DEFAULT_SNAP_BUNDLE,
              id,
              status: SnapStatus.Stopped,
            }),
          ),
        },
      }),
    );

    // persist the state somewhere
    const persistedState = getPersistentState<SnapControllerState>(
      firstSnapController.state,
      firstSnapController.metadata,
    );

    // create a new controller
    const secondSnapController = getSnapController(
      getSnapControllerOptions({
        state: persistedState,
      }),
    );

    expect(secondSnapController.isRunning(id)).toBe(false);
    await secondSnapController.startSnap(id);

    expect(secondSnapController.state.snaps[id]).toBeDefined();
    expect(secondSnapController.isRunning(id)).toBe(true);
    firstSnapController.destroy();
    secondSnapController.destroy();
  });

  it('does not persist snaps in the installing state', async () => {
    const firstSnapController = getSnapController(
      getSnapControllerOptions({
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({
              version: '0.0.1',
              sourceCode: DEFAULT_SNAP_BUNDLE,
              status: SnapStatus.Installing,
            }),
          ),
        },
      }),
    );

    expect(firstSnapController.state.snaps[MOCK_SNAP_ID]).toBeDefined();

    // persist the state somewhere
    const persistedState = getPersistentState<SnapControllerState>(
      firstSnapController.state,
      firstSnapController.metadata,
    );

    // create a new controller
    const secondSnapController = getSnapController(
      getSnapControllerOptions({
        state: persistedState,
      }),
    );

    expect(secondSnapController.state.snaps[MOCK_SNAP_ID]).toBeUndefined();
    firstSnapController.destroy();
    secondSnapController.destroy();
  });

  it('handles an error event on the controller messenger', async () => {
    const options = getSnapControllerWithEESOptions({
      state: {
        snaps: getPersistedSnapsState(),
      },
    });
    const { rootMessenger } = options;
    const [snapController, service] = getSnapControllerWithEES(options);

    const snap = snapController.getExpect(MOCK_SNAP_ID);
    await snapController.startSnap(snap.id);

    // defer
    setTimeout(() => {
      rootMessenger.publish('ExecutionService:unhandledError', snap.id, {
        message: 'foo',
        code: 123,
      });
    }, 1);

    await new Promise((resolve) => {
      rootMessenger.subscribe('SnapController:stateChange', (state) => {
        const crashedSnap = state.snaps[snap.id];
        expect(crashedSnap.status).toStrictEqual(SnapStatus.Crashed);
        resolve(undefined);
        snapController.destroy();
      });
    });
    await service.terminateAllSnaps();
  });

  it('adds a snap and uses its JSON-RPC API and then get stopped from idling too long', async () => {
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        idleTimeCheckInterval: 10,
        maxIdleTime: 50,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);
    await snapController.startSnap(snap.id);

    await snapController.handleRequest({
      snapId: snap.id,
      origin: 'foo.com',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    await delay(100);

    expect(snapController.isRunning(snap.id)).toBe(false);
    snapController.destroy();

    await service.terminateAllSnaps();
  });

  it('terminates a snap even if connection to worker has failed', async () => {
    const rootMessenger = getControllerMessenger();
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        rootMessenger,
        idleTimeCheckInterval: 10,
        maxIdleTime: 50,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      (_origin, permission) => {
        return permission === SnapEndowments.Rpc;
      },
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);
    await snapController.startSnap(snap.id);

    // @ts-expect-error `maxRequestTime` is a private property.
    snapController.maxRequestTime = 50;

    // @ts-expect-error `command` is a private property.
    service.command = async () => sleep(100);

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`${snap.id} failed to respond to the request in time.`);

    expect(snapController.state.snaps[snap.id].status).toBe('crashed');
    snapController.destroy();

    await service.terminateAllSnaps();
  });

  it(`reads a snap's status after adding it`, async () => {
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        idleTimeCheckInterval: 1000,
        maxIdleTime: 2000,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await snapController.stopSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('adds a snap, stops it, and starts it again on-demand', async () => {
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        idleTimeCheckInterval: 1000,
        maxIdleTime: 2000,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await snapController.stopSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    const results = await snapController.handleRequest({
      snapId: snap.id,
      origin: 'foo.com',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });
    expect(results).toBe('test1');

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('includes the initialConnections data in the approval requestState when installing a Snap', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({}),
    );

    const initialConnections = {
      'npm:filsnap': {},
      'https://snaps.metamask.io': {},
    };

    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        initialConnections,
      }),
    });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect({ manifest }),
      }),
    );

    await snapController.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: {},
    });

    expect(messenger.call).toHaveBeenNthCalledWith(
      4,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          loading: false,
          connections: initialConnections,
          permissions: expect.anything(),
        },
      },
    );

    snapController.destroy();
  });

  it('includes the initialConnections data in the requestState when updating a Snap without pre-existing connections', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({}),
    );

    const initialConnections = {
      'npm:filsnap': {},
      'https://snaps.metamask.io': {},
      'https://metamask.github.io': {},
    };

    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        version: '1.1.0' as SemVerVersion,
        initialConnections,
      }),
    });

    const detectSnapLocation = loopbackDetect({
      manifest: manifest.result,
    });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
        detectSnapLocation,
      }),
    );

    await snapController.updateSnap(
      MOCK_ORIGIN,
      MOCK_SNAP_ID,
      detectSnapLocation(),
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      4,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          permissions: expect.anything(),
          newVersion: '1.1.0',
          newPermissions: expect.anything(),
          approvedPermissions: {},
          unusedPermissions: {},
          loading: false,
          newConnections: initialConnections,
          unusedConnections: {},
          approvedConnections: {},
        },
      },
    );

    snapController.destroy();
  });

  it('includes the initialConnections data in the requestState when updating a Snap with pre-existing connections', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      (origin) =>
        ['https://portfolio.metamask.io', 'https://snaps.metamask.io'].includes(
          origin,
        )
          ? ({
              [WALLET_SNAP_PERMISSION_KEY]: {
                caveats: [
                  {
                    type: SnapCaveatType.SnapIds,
                    value: {
                      [MOCK_SNAP_ID]: {},
                    },
                  },
                ],
                date: 1664187844588,
                id: 'izn0WGUO8cvq_jqvLQuQP',
                invoker: origin,
                parentCapability: WALLET_SNAP_PERMISSION_KEY,
              },
            } as Record<string, PermissionConstraint>)
          : {},
    );

    const initialConnections = {
      'npm:filsnap': {},
      'https://snaps.metamask.io': {},
      'https://metamask.github.io': {},
    };

    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        version: '1.1.0' as SemVerVersion,
        initialConnections,
      }),
    });

    const detectSnapLocation = loopbackDetect({
      manifest: manifest.result,
    });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({
              manifest: {
                initialConnections: {
                  'https://snaps.metamask.io': {},
                  'https://portfolio.metamask.io': {},
                },
              },
            }),
          ),
        },
        detectSnapLocation,
      }),
    );

    await snapController.updateSnap(
      MOCK_ORIGIN,
      MOCK_SNAP_ID,
      detectSnapLocation(),
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      6,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          permissions: expect.anything(),
          newVersion: '1.1.0',
          newPermissions: expect.anything(),
          approvedPermissions: {},
          unusedPermissions: {},
          loading: false,
          newConnections: {
            'npm:filsnap': {},
            'https://metamask.github.io': {},
          },
          unusedConnections: {
            'https://portfolio.metamask.io': {},
          },
          approvedConnections: {
            'https://snaps.metamask.io': {},
          },
        },
      },
    );

    snapController.destroy();
  });

  it('includes the initialConnections data in the requestState when updating a Snap with pre-existing connections where some are revoked', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);

    // Simulate all permissions being revoked.
    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({}),
    );

    const initialConnections = {
      'npm:filsnap': {},
      'https://snaps.metamask.io': {},
      'https://metamask.github.io': {},
    };

    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        version: '1.1.0' as SemVerVersion,
        initialConnections,
      }),
    });

    const detectSnapLocation = loopbackDetect({
      manifest: manifest.result,
    });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({
              manifest: {
                initialConnections: {
                  'https://snaps.metamask.io': {},
                  'https://portfolio.metamask.io': {},
                },
              },
            }),
          ),
        },
        detectSnapLocation,
      }),
    );

    await snapController.updateSnap(
      MOCK_ORIGIN,
      MOCK_SNAP_ID,
      detectSnapLocation(),
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      6,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          permissions: expect.anything(),
          newVersion: '1.1.0',
          newPermissions: expect.anything(),
          approvedPermissions: {},
          unusedPermissions: {},
          loading: false,
          newConnections: {
            'npm:filsnap': {},
            'https://metamask.github.io': {},
            'https://snaps.metamask.io': {},
          },
          unusedConnections: {},
          approvedConnections: {},
        },
      },
    );

    snapController.destroy();
  });

  it('installs a snap via installSnaps', async () => {
    const messenger = getSnapControllerMessenger();
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect(),
      }),
    );

    jest.spyOn(messenger, 'publish');

    const expectedSnapObject = getTruncatedSnap();
    const permissions = {
      ...getSnapManifest().initialPermissions,
      [SnapEndowments.Rpc]: {
        caveats: [{ type: 'rpcOrigin', value: { dapps: false, snaps: true } }],
      },
    };

    expect(
      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).toStrictEqual({
      [MOCK_SNAP_ID]: expectedSnapObject,
    });

    expect(messenger.call).toHaveBeenCalledTimes(10);

    expect(messenger.call).toHaveBeenNthCalledWith(
      1,
      'ApprovalController:addRequest',
      expect.objectContaining({
        requestData: {
          metadata: {
            origin: MOCK_SNAP_ID,
            dappOrigin: MOCK_ORIGIN,
            id: expect.any(String),
          },
          snapId: MOCK_SNAP_ID,
        },
        requestState: {
          loading: true,
        },
      }),
      true,
    );

    expect(messenger.call).toHaveBeenNthCalledWith(2, 'SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0',
        checksum: DEFAULT_SNAP_SHASUM,
        permissions: getSnapManifest().initialPermissions,
      },
    });

    expect(messenger.call).toHaveBeenNthCalledWith(
      3,
      'SubjectMetadataController:addSubjectMetadata',
      {
        subjectType: SubjectType.Snap,
        name: MOCK_SNAP_NAME,
        origin: MOCK_SNAP_ID,
        version: '1.0.0',
        svgIcon: DEFAULT_SNAP_ICON,
      },
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      4,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          loading: false,
          connections: {},
          permissions,
        },
      },
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      5,
      'PermissionController:grantPermissions',
      expect.any(Object),
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      6,
      'ApprovalController:addRequest',
      expect.objectContaining({
        requestData: {
          metadata: {
            origin: MOCK_SNAP_ID,
            dappOrigin: MOCK_ORIGIN,
            id: expect.any(String),
          },
          snapId: MOCK_SNAP_ID,
        },
        requestState: {
          loading: true,
        },
      }),
      true,
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      7,
      'ExecutionService:executeSnap',
      expect.any(Object),
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      8,
      'ApprovalController:updateRequestState',
      {
        id: expect.any(String),
        requestState: {
          loading: false,
          type: SNAP_APPROVAL_INSTALL,
        },
      },
    );

    expect(messenger.publish).toHaveBeenCalledWith(
      'SnapController:snapInstallStarted',
      MOCK_SNAP_ID,
      MOCK_ORIGIN,
      false,
    );
    expect(messenger.publish).toHaveBeenCalledWith(
      'SnapController:snapInstalled',
      getTruncatedSnap(),
      MOCK_ORIGIN,
      false,
    );

    snapController.destroy();
  });

  it('supports non-snap permissions', async () => {
    const messenger = getSnapControllerMessenger();
    const initialPermissions: SnapPermissions = {
      [handlerEndowments.onRpcRequest as string]: { snaps: false, dapps: true },
      // @ts-expect-error Current type only expects snap permissions
      // eslint-disable-next-line @typescript-eslint/naming-convention
      eth_accounts: {
        requiredMethods: [],
      },
    };

    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        initialPermissions,
      }),
    });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect({
          manifest: manifest.result,
        }),
      }),
    );

    const expectedSnapObject = getTruncatedSnap({ initialPermissions });

    expect(
      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).toStrictEqual({
      [MOCK_SNAP_ID]: expectedSnapObject,
    });

    snapController.destroy();
  });

  it('throws an error if the installation is disabled during installSnaps', async () => {
    const controller = getSnapController(
      getSnapControllerOptions({
        featureFlags: {
          disableSnapInstallation: true,
        },
      }),
    );

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).rejects.toThrow(
      'Installing Snaps is currently disabled in this version of MetaMask.',
    );

    controller.destroy();
  });

  it('throws an error if the platform is disabled during installSnaps', async () => {
    const controller = getSnapController(
      getSnapControllerOptions({
        getFeatureFlags: () => ({ disableSnaps: true }),
      }),
    );

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).rejects.toThrow(
      'The Snaps platform requires basic functionality to be used. Enable basic functionality in the settings to use the Snaps platform.',
    );

    controller.destroy();
  });

  it('throws an error if the platform is disabled during handleRequest', async () => {
    const controller = getSnapController(
      getSnapControllerOptions({
        getFeatureFlags: () => ({ disableSnaps: true }),
        state: getPersistedSnapsState(),
      }),
    );

    await expect(
      controller.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
        handler: HandlerType.OnRpcRequest,
        request: { method: 'foo' },
      }),
    ).rejects.toThrow(
      'The Snaps platform requires basic functionality to be used. Enable basic functionality in the settings to use the Snaps platform.',
    );

    controller.destroy();
  });

  it('throws an error on invalid semver range during installSnaps', async () => {
    const controller = getSnapController();

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: 'foo' },
      }),
    ).rejects.toThrow(
      'The "version" field must be a valid SemVer version range if specified. Received: "foo".',
    );

    controller.destroy();
  });

  it("throws an error if semver version range doesn't match downloaded version", async () => {
    const controller = getSnapController(
      getSnapControllerOptions({ detectSnapLocation: loopbackDetect() }),
    );

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: '1.2.0' },
      }),
    ).rejects.toThrow(
      `Version mismatch. Manifest for "npm:@metamask/example-snap" specifies version "1.0.0" which doesn't satisfy requested version range "1.2.0".`,
    );

    controller.destroy();
  });

  it('throws an error if snap is not on allowlist and allowlisting is required but resolve succeeds', async () => {
    const registry = new MockSnapsRegistry();
    const rootMessenger = getControllerMessenger(registry);
    const messenger = getSnapControllerMessenger(rootMessenger);
    const controller = getSnapController(
      getSnapControllerOptions({
        featureFlags: { requireAllowlist: true },
        messenger,
        detectSnapLocation: (_location, options) =>
          new LoopbackLocation(options),
      }),
    );

    // Mock resolve to succeed, but registry.get() will fail later
    registry.resolveVersion.mockReturnValue('1.0.0');

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: DEFAULT_REQUESTED_SNAP_VERSION },
      }),
    ).rejects.toThrow(
      'Cannot install version "1.0.0" of snap "npm:@metamask/example-snap": The snap is not on the allowlist.',
    );

    expect(registry.resolveVersion).toHaveBeenCalled();

    controller.destroy();
  });

  it('throws an error if the registry is unavailable and allowlisting is required but resolve succeeds', async () => {
    const registry = new MockSnapsRegistry();
    const rootMessenger = getControllerMessenger(registry);
    const messenger = getSnapControllerMessenger(rootMessenger);
    const controller = getSnapController(
      getSnapControllerOptions({
        featureFlags: { requireAllowlist: true },
        messenger,
        detectSnapLocation: (_location, options) =>
          new LoopbackLocation(options),
      }),
    );

    // Mock resolve to succeed, but registry.get() will fail later
    registry.resolveVersion.mockReturnValue('1.0.0');
    registry.get.mockReturnValue({
      [MOCK_SNAP_ID]: { status: SnapsRegistryStatus.Unavailable },
    });

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: DEFAULT_REQUESTED_SNAP_VERSION },
      }),
    ).rejects.toThrow(
      'Cannot install version "1.0.0" of snap "npm:@metamask/example-snap": The registry is temporarily unavailable.',
    );

    expect(registry.resolveVersion).toHaveBeenCalled();

    controller.destroy();
  });

  it('throws an error if snap is not on allowlist and allowlisting is required', async () => {
    const { manifest, sourceCode, svgIcon } =
      await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_getBip44Entropy: [{ coinType: 1 }],
          },
        }),
      });

    const controller = getSnapController(
      getSnapControllerOptions({
        featureFlags: { requireAllowlist: true },
        detectSnapLocation: loopbackDetect({
          manifest: manifest.result,
          files: [sourceCode, svgIcon as VirtualFile],
        }),
      }),
    );

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: DEFAULT_REQUESTED_SNAP_VERSION },
      }),
    ).rejects.toThrow(
      'Cannot install version "1.0.0" of snap "npm:@metamask/example-snap": The snap is not on the allowlist.',
    );

    controller.destroy();
  });

  it('resolves to allowlisted version when allowlisting is required', async () => {
    const registry = new MockSnapsRegistry();
    const rootMessenger = getControllerMessenger(registry);
    const messenger = getSnapControllerMessenger(rootMessenger);

    const { manifest, sourceCode, svgIcon } =
      await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });

    registry.get.mockResolvedValueOnce({
      [MOCK_SNAP_ID]: { status: SnapsRegistryStatus.Verified },
    });

    registry.resolveVersion.mockReturnValue('1.1.0');

    const controller = getSnapController(
      getSnapControllerOptions({
        messenger,
        featureFlags: { requireAllowlist: true },
        detectSnapLocation: (_location, options) =>
          new LoopbackLocation({
            ...options,
            manifest,
            files: [sourceCode, svgIcon as VirtualFile],
          }),
      }),
    );

    await controller.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: { version: '^1.0.0' },
    });

    expect(controller.get(MOCK_SNAP_ID)?.version).toBe('1.1.0');
    expect(registry.resolveVersion).toHaveBeenCalled();

    controller.destroy();
  });

  it('does not use registry resolving when allowlist is not required', async () => {
    const registry = new MockSnapsRegistry();
    const rootMessenger = getControllerMessenger(registry);
    const messenger = getSnapControllerMessenger(rootMessenger);
    const controller = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: (_location, options) =>
          new LoopbackLocation(options),
      }),
    );

    await controller.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: { version: DEFAULT_REQUESTED_SNAP_VERSION },
    });

    expect(registry.resolveVersion).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('reuses an already installed snap if it satisfies the requested SemVer range', async () => {
    const messenger = getSnapControllerMessenger();
    const controller = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const authorizeSpy = jest.spyOn(controller as any, 'authorize');

    await controller.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: { version: '>0.9.0 <1.1.0' },
    });

    const newSnap = controller.get(MOCK_SNAP_ID);

    expect(newSnap).toStrictEqual(getSnapObject());
    expect(authorizeSpy).not.toHaveBeenCalled();
    expect(messenger.call).not.toHaveBeenCalled();

    controller.destroy();
  });

  it('fails to install snap if user rejects installation', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const controller = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect(),
      }),
    );

    rootMessenger.registerActionHandler(
      'ApprovalController:updateRequestState',
      (request) => {
        approvalControllerMock.updateRequestStateAndReject.bind(
          approvalControllerMock,
        )(request);
      },
    );

    await expect(
      controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).rejects.toThrow('User rejected the request.');

    expect(messenger.call).toHaveBeenNthCalledWith(
      1,
      'ApprovalController:addRequest',
      expect.objectContaining({
        id: expect.any(String),
        type: SNAP_APPROVAL_INSTALL,
        requestData: {
          metadata: {
            origin: MOCK_SNAP_ID,
            dappOrigin: MOCK_ORIGIN,
            id: expect.any(String),
          },
          snapId: MOCK_SNAP_ID,
        },
        requestState: {
          loading: true,
        },
      }),
      true,
    );

    expect(messenger.call).toHaveBeenNthCalledWith(
      5,
      'ApprovalController:updateRequestState',
      expect.objectContaining({
        id: expect.any(String),
        requestState: {
          loading: false,
          error: providerErrors.userRejectedRequest().message,
          type: SNAP_APPROVAL_INSTALL,
        },
      }),
    );

    expect(controller.get(MOCK_SNAP_ID)).toBeUndefined();

    expect(messenger.publish).not.toHaveBeenCalledWith(
      'SnapController:snapUninstalled',
      getTruncatedSnap(),
    );

    controller.destroy();
  });

  it('removes a snap that errors during installation after being added', async () => {
    const messenger = getSnapControllerMessenger();
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect(),
      }),
    );

    const messengerCallMock = jest.spyOn(messenger, 'call');

    jest
      .spyOn(snapController as any, 'authorize')
      .mockImplementationOnce(() => {
        throw new Error('foo');
      });

    await expect(
      snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).rejects.toThrow('foo');

    expect(messengerCallMock).toHaveBeenCalledTimes(9);

    expect(messengerCallMock).toHaveBeenNthCalledWith(
      4,
      'ApprovalController:updateRequestState',
      expect.objectContaining({
        id: expect.any(String),
        requestState: {
          loading: false,
          error: 'foo',
          type: SNAP_APPROVAL_INSTALL,
        },
      }),
    );

    expect(messenger.publish).not.toHaveBeenCalledWith(
      'SnapController:snapUninstalled',
      getTruncatedSnap(),
    );

    snapController.destroy();
  });

  it('adds a snap, disable/enables it, and still gets a response from an RPC method', async () => {
    const [snapController, service] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        idleTimeCheckInterval: 1000,
        maxRequestTime: 2000,
        maxIdleTime: 2000,
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({ status: SnapStatus.Installing }),
          ),
        },
      }),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(
      `Snap "${MOCK_SNAP_ID}" is currently being installed. Please try again later.`,
    );

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await snapController.stopSnap(snap.id);

    await snapController.disableSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    await expect(snapController.startSnap(snap.id)).rejects.toThrow(
      `Snap "${MOCK_SNAP_ID}" is disabled.`,
    );

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: MOCK_ORIGIN,
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`Snap "${MOCK_SNAP_ID}" is disabled.`);

    expect(snapController.state.snaps[snap.id].status).toBe('stopped');
    expect(snapController.state.snaps[snap.id].enabled).toBe(false);

    snapController.enableSnap(snap.id);
    expect(snapController.state.snaps[snap.id].enabled).toBe(true);

    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    const result = await snapController.handleRequest({
      snapId: snap.id,
      origin: MOCK_ORIGIN,
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    expect(result).toBe('test1');
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('times out an RPC request that takes too long', async () => {
    const rootMessenger = getControllerMessenger();
    const options = getSnapControllerWithEESOptions({
      rootMessenger,
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      // Note that we are using the default maxRequestTime
      state: {
        snaps: getPersistedSnapsState(),
      },
    });

    const snapController = getSnapController(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => await sleep(100),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      (_origin, permission) => {
        return permission === SnapEndowments.Rpc;
      },
    );

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    // We set the maxRequestTime to a low enough value for it to time out
    // @ts-expect-error - `maxRequestTime` is a private property.
    snapController.maxRequestTime = 50;

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`${snap.id} failed to respond to the request in time.`);
    expect(snapController.state.snaps[snap.id].status).toBe('crashed');

    snapController.destroy();
  });

  it('terminates idle snap that hasnt had any requests', async () => {
    const options = getSnapControllerOptions({
      idleTimeCheckInterval: 10,
      maxIdleTime: 50,
      state: {
        snaps: getPersistedSnapsState(),
      },
    });

    const snapController = getSnapController(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await sleep(100);

    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    snapController.destroy();
  });

  it('uses the execution timeout specified by the snap', async () => {
    const rootMessenger = getControllerMessenger();
    const options = getSnapControllerWithEESOptions({
      rootMessenger,
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      // Note that we are using the default maxRequestTime
      state: {
        snaps: getPersistedSnapsState(getPersistedSnapObject()),
      },
    });

    const snapController = getSnapController(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => await sleep(100),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return {
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: { snaps: true, dapps: false },
              },
              {
                type: SnapCaveatType.MaxRequestTime,
                // This is not a valid value, but we aren't using the PermissionController so we use an invalid version.
                value: 50,
              },
            ],
          },
        };
      },
    );

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`${snap.id} failed to respond to the request in time.`);
    expect(snapController.state.snaps[snap.id].status).toBe('crashed');

    snapController.destroy();
  });

  it('does not timeout while waiting for response from MetaMask', async () => {
    const sourceCode = `
    module.exports.onRpcRequest = () => ethereum.request({ method: 'eth_blockNumber', params: [] });
    `;

    const options = getSnapControllerWithEESOptions({
      environmentEndowmentPermissions: [SnapEndowments.EthereumProvider],
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      state: {
        snaps: getPersistedSnapsState(
          getPersistedSnapObject({
            sourceCode,
            manifest: getSnapManifest({
              shasum: await getSnapChecksum(getMockSnapFiles({ sourceCode })),
            }),
          }),
        ),
      },
    });

    const [snapController, service] = getSnapControllerWithEES(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    jest
      // Cast because we are mocking a private property
      .spyOn(service, 'setupSnapProvider' as any)
      .mockImplementation((_snapId, rpcStream) => {
        const mux = setupMultiplex(rpcStream as Duplex, 'foo');
        const stream = mux.createStream('metamask-provider');
        const engine = new JsonRpcEngine();
        const middleware = createAsyncMiddleware(async (req, res, _next) => {
          if (req.method === 'eth_blockNumber') {
            await sleep(100);
            res.result = MOCK_BLOCK_NUMBER;
          }
        });
        engine.push(middleware);
        const providerStream = createEngineStream({ engine });
        pipeline(stream, providerStream, stream, (error) => {
          if (error) {
            logError(`Provider stream failure.`, error);
          }
        });
      });

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    // Max request time should be shorter than eth_blockNumber takes to respond
    // @ts-expect-error - `maxRequestTime` is a private property.
    snapController.maxRequestTime = 50;

    expect(
      await snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).toBe(MOCK_BLOCK_NUMBER);

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('does not timeout while waiting for response from MetaMask when snap does multiple calls', async () => {
    const sourceCode = `
    const fetch = async () => parseInt(await ethereum.request({ method: 'eth_blockNumber', params: [] }), 16);
    module.exports.onRpcRequest = async () => (await fetch()) + (await fetch());
    `;

    const options = getSnapControllerWithEESOptions({
      environmentEndowmentPermissions: [SnapEndowments.EthereumProvider],
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      state: {
        snaps: getPersistedSnapsState(
          getPersistedSnapObject({
            sourceCode,
            manifest: getSnapManifest({
              shasum: await getSnapChecksum(getMockSnapFiles({ sourceCode })),
            }),
          }),
        ),
      },
    });

    const { rootMessenger } = options;
    const [snapController, service] = getSnapControllerWithEES(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      () => true,
    );

    jest
      // Cast because we are mocking a private property
      .spyOn(service, 'setupSnapProvider' as any)
      .mockImplementation((_snapId, rpcStream) => {
        const mux = setupMultiplex(rpcStream as Duplex, 'foo');
        const stream = mux.createStream('metamask-provider');
        const engine = new JsonRpcEngine();
        const middleware = createAsyncMiddleware(async (req, res, _next) => {
          if (req.method === 'eth_blockNumber') {
            await sleep(100);
            res.result = MOCK_BLOCK_NUMBER;
          }
        });
        engine.push(middleware);
        const providerStream = createEngineStream({ engine });
        pipeline(stream, providerStream, stream, (error) => {
          if (error) {
            logError(`Provider stream failure.`, error);
          }
        });
      });

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    // Max request time should be shorter than eth_blockNumber takes to respond
    // @ts-expect-error - `maxRequestTime` is a private property.
    snapController.maxRequestTime = 50;

    expect(
      await snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).toBe(21896426);

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('gracefully throws for multiple failing requests', async () => {
    const sourceCode = `
    module.exports.onRpcRequest = async () => snap.request({ method: 'snap_dialog', params: null });
    `;

    const options = getSnapControllerWithEESOptions({
      environmentEndowmentPermissions: [SnapEndowments.EthereumProvider],
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      state: {
        snaps: getPersistedSnapsState(
          getPersistedSnapObject({
            sourceCode,
            manifest: getSnapManifest({
              shasum: await getSnapChecksum(getMockSnapFiles({ sourceCode })),
            }),
          }),
        ),
      },
    });

    const { rootMessenger } = options;
    const [snapController, service] = getSnapControllerWithEES(options);
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      () => true,
    );

    const results = (await Promise.allSettled([
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ])) as PromiseRejectedResult[];

    expect(results[0].status).toBe('rejected');
    expect(results[0].reason.message).toBe(
      "'args.params' must be an object or array if provided.",
    );
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toBe(
      "'args.params' must be an object or array if provided.",
    );

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  // This isn't stable in CI unfortunately
  it.skip('throws if the Snap is terminated while executing', async () => {
    const { manifest, sourceCode, svgIcon } =
      await getMockSnapFilesWithUpdatedChecksum({
        sourceCode: `
      module.exports.onRpcRequest = () => {
        return new Promise((resolve) => {});
      };
    `,
      });

    const [snapController] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        detectSnapLocation: loopbackDetect({
          manifest,
          files: [sourceCode, svgIcon as VirtualFile],
        }),
      }),
    );

    await snapController.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: {},
    });

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    expect(snapController.state.snaps[snap.id].status).toBe('running');

    const promise = snapController.handleRequest({
      snapId: snap.id,
      origin: 'foo.com',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    const results = await Promise.allSettled([
      snapController.removeSnap(snap.id),
      promise,
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe(
      `The snap "${snap.id}" has been terminated during execution.`,
    );

    snapController.destroy();
  });

  it('throws if unresponsive Snap is terminated while executing', async () => {
    const { manifest, sourceCode, svgIcon } =
      await getMockSnapFilesWithUpdatedChecksum({
        sourceCode: `
      module.exports.onRpcRequest = () => {
        while(true) {}
      };
    `,
      });

    const [snapController] = getSnapControllerWithEES(
      getSnapControllerWithEESOptions({
        detectSnapLocation: loopbackDetect({
          manifest,
          files: [sourceCode, svgIcon as VirtualFile],
        }),
      }),
    );

    await snapController.installSnaps(MOCK_ORIGIN, {
      [MOCK_SNAP_ID]: {},
    });

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    expect(snapController.state.snaps[snap.id].status).toBe('running');

    const promise = snapController.handleRequest({
      snapId: snap.id,
      origin: 'foo.com',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      },
    });

    const results = await Promise.allSettled([
      snapController.removeSnap(snap.id),
      promise,
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe(
      `${snap.id} failed to respond to the request in time.`,
    );

    snapController.destroy();
  });

  it('does not kill snaps with open sessions', async () => {
    const sourceCode = `
      module.exports.onRpcRequest = () => 'foo bar';
    `;

    const rootMessenger = getControllerMessenger();
    const options = getSnapControllerWithEESOptions({
      rootMessenger,
      idleTimeCheckInterval: 10,
      maxIdleTime: 50,
      state: {
        snaps: getPersistedSnapsState(
          getPersistedSnapObject({
            sourceCode,
            manifest: getSnapManifest({
              shasum: await getSnapChecksum(getMockSnapFiles({ sourceCode })),
            }),
          }),
        ),
      },
    });
    const [snapController, service] = getSnapControllerWithEES(options);

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      () => true,
    );

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    rootMessenger.call(
      'SnapController:incrementActiveReferences',
      MOCK_SNAP_ID,
    );

    expect(
      await snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).toBe('foo bar');

    await sleep(100);

    // Should still be running after idle timeout
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    options.rootMessenger.call(
      'SnapController:decrementActiveReferences',
      MOCK_SNAP_ID,
    );

    await sleep(100);

    // Should be terminated by idle timeout now
    expect(snapController.state.snaps[snap.id].status).toBe('stopped');

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it(`shouldn't time out a long running snap on start up`, async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        maxRequestTime: 50,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      () => true,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:executeSnap',
      async () => await sleep(300),
    );

    const snap = snapController.getExpect(MOCK_SNAP_ID);

    const startPromise = snapController.startSnap(snap.id);
    const timeoutPromise = sleep(50).then(() => true);

    expect(
      // Race the promises to check that startPromise does not time out
      await Promise.race([startPromise, timeoutPromise]),
    ).toBe(true);

    snapController.destroy();
  });

  it('removes a snap that is stopped without errors', async () => {
    const rootMessenger = getControllerMessenger();
    const options = getSnapControllerWithEESOptions({
      rootMessenger,
      idleTimeCheckInterval: 30000,
      maxIdleTime: 160000,
      maxRequestTime: 300,
      state: {
        snaps: getPersistedSnapsState(),
      },
    });

    const { messenger } = options;

    const [snapController, service] = getSnapControllerWithEES(
      options,
      new ExecutionEnvironmentStub(
        getNodeEESMessenger(options.rootMessenger),
      ) as unknown as NodeThreadExecutionService,
    );
    const snap = snapController.getExpect(MOCK_SNAP_ID);

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => await sleep(30000),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:hasPermission',
      (_origin, permission) => {
        return permission === SnapEndowments.Rpc;
      },
    );

    await snapController.startSnap(snap.id);
    expect(snapController.state.snaps[snap.id].status).toBe('running');

    await expect(
      snapController.handleRequest({
        snapId: snap.id,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'test',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`${snap.id} failed to respond to the request in time.`);
    expect(snapController.state.snaps[snap.id].status).toBe('crashed');

    await snapController.removeSnap(snap.id);

    expect(snapController.state.snaps[snap.id]).toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(messenger.publish).toHaveBeenCalledWith(
      'SnapController:snapUninstalled',
      getTruncatedSnap(),
    );

    snapController.destroy();
    await service.terminateAllSnaps();
  });

  it('clears encrypted state of Snaps when the client is locked', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);

    const state = { myVariable: 1 };

    const mockEncryptedState = await encrypt(
      ENCRYPTION_KEY,
      state,
      undefined,
      undefined,
      DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
    );

    const getMnemonic = jest
      .fn()
      .mockReturnValue(TEST_SECRET_RECOVERY_PHRASE_BYTES);

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: {
            [MOCK_SNAP_ID]: getPersistedSnapObject(),
          },
          snapStates: {
            [MOCK_SNAP_ID]: mockEncryptedState,
          },
        },
        getMnemonic,
      }),
    );

    expect(
      await messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
    ).toStrictEqual(state);
    expect(getMnemonic).toHaveBeenCalledTimes(1);

    rootMessenger.publish('KeyringController:lock');

    expect(
      await messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
    ).toStrictEqual(state);

    // We assume `getMnemonic` is called again because the controller needs to
    // decrypt the state again. This is not an ideal way to test this, but it
    // is the easiest to test this without exposing the internal state of the
    // `SnapController`.
    expect(getMnemonic).toHaveBeenCalledTimes(2);

    snapController.destroy();
  });

  describe('handleRequest', () => {
    it.each(
      Object.keys(handlerEndowments).filter(
        (handler) => handlerEndowments[handler as HandlerType],
      ) as HandlerType[],
    )(
      'throws if the snap does not have permission for the handler',
      async (handler) => {
        const rootMessenger = getControllerMessenger();
        const messenger = getSnapControllerMessenger(rootMessenger);
        const snapController = getSnapController(
          getSnapControllerOptions({
            messenger,
            state: {
              snaps: getPersistedSnapsState(),
            },
          }),
        );

        rootMessenger.registerActionHandler(
          'PermissionController:getPermissions',
          () => ({}),
        );

        const snap = snapController.getExpect(MOCK_SNAP_ID);
        await expect(
          snapController.handleRequest({
            snapId: snap.id,
            origin: 'foo.com',
            handler,
            request: { jsonrpc: '2.0', method: 'test' },
          }),
        ).rejects.toThrow(
          `Snap "${snap.id}" is not permitted to use "${
            handlerEndowments[handler] as string
          }".`,
        );

        snapController.destroy();
      },
    );

    it('does not throw if the snap uses a permitted handler', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => false,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'foo.com',
          handler: HandlerType.OnUserInput,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows MetaMask to send a JSON-RPC request', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: {
                  allowedOrigins: ['foo.com'],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => undefined,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'metamask',
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows MetaMask to send a keyring request', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Keyring]: {
            ...MOCK_KEYRING_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.KeyringOrigin,
                value: {
                  allowedOrigins: ['foo.com'],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => undefined,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'metamask',
          handler: HandlerType.OnKeyringRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows a website origin if it is in the `allowedOrigins` list', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: {
                  allowedOrigins: ['foo.com'],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_DAPP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows a website origin if it is in the `allowedOrigins` list for keyring requests', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Keyring]: {
            ...MOCK_KEYRING_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.KeyringOrigin,
                value: {
                  allowedOrigins: ['foo.com'],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_DAPP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'foo.com',
          handler: HandlerType.OnKeyringRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows a website origin if `dapps` is `true`', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: {
                  dapps: true,
                  allowedOrigins: [],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_DAPP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows a Snap origin if it is in the `allowedOrigins` list', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: {
                  allowedOrigins: [MOCK_SNAP_ID],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: MOCK_SNAP_ID,
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it('allows a Snap origin if `snaps` is `true`', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: {
            ...MOCK_RPC_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.RpcOrigin,
                value: {
                  snaps: true,
                  allowedOrigins: [],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      expect(
        await snapController.handleRequest({
          snapId: snap.id,
          origin: MOCK_SNAP_ID,
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).toBeUndefined();

      snapController.destroy();
    });

    it.each([
      {
        snaps: true,
      },
      {
        allowedOrigins: ['foo.com'],
      },
      {
        snaps: true,
        allowedOrigins: ['foo.com'],
      },
    ])(
      'throws if the origin is not in the `allowedOrigins` list (%p)',
      async (value: RpcOrigins) => {
        const rootMessenger = getControllerMessenger();
        const messenger = getSnapControllerMessenger(rootMessenger);
        const snapController = getSnapController(
          getSnapControllerOptions({
            messenger,
            state: {
              snaps: getPersistedSnapsState(),
            },
          }),
        );

        rootMessenger.registerActionHandler(
          'PermissionController:getPermissions',
          () => ({
            [SnapEndowments.Rpc]: {
              ...MOCK_RPC_ORIGINS_PERMISSION,
              caveats: [
                {
                  type: SnapCaveatType.RpcOrigin,
                  value,
                },
              ],
            },
          }),
        );

        rootMessenger.registerActionHandler(
          'SubjectMetadataController:getSubjectMetadata',
          () => MOCK_DAPP_SUBJECT_METADATA,
        );

        const snap = snapController.getExpect(MOCK_SNAP_ID);
        await expect(
          snapController.handleRequest({
            snapId: snap.id,
            origin: 'bar.com',
            handler: HandlerType.OnRpcRequest,
            request: { jsonrpc: '2.0', method: 'test' },
          }),
        ).rejects.toThrow(
          `Snap "${snap.id}" is not permitted to handle requests from "bar.com".`,
        );

        snapController.destroy();
      },
    );

    it('throws if the snap does not have permission to handle JSON-RPC requests from dapps', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          // Permission to receive JSON-RPC requests from other Snaps.
          [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_DAPP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      await expect(
        snapController.handleRequest({
          snapId: snap.id,
          origin: MOCK_ORIGIN,
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).rejects.toThrow(
        `Snap "${snap.id}" is not permitted to handle requests from "${MOCK_ORIGIN}".`,
      );

      snapController.destroy();
    });

    it('throws if the snap does not have permission to handle JSON-RPC requests from snaps', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          // Permission to receive JSON-RPC requests from dapps.
          [SnapEndowments.Rpc]: MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      await expect(
        snapController.handleRequest({
          snapId: snap.id,
          origin: MOCK_SNAP_ID,
          handler: HandlerType.OnRpcRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).rejects.toThrow(
        `Snap "${snap.id}" is not permitted to handle requests from "${MOCK_SNAP_ID}".`,
      );

      snapController.destroy();
    });

    it('throws if the website origin is not in the `allowedOrigins` list for keyring requests', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Keyring]: {
            ...MOCK_KEYRING_ORIGINS_PERMISSION,
            caveats: [
              {
                type: SnapCaveatType.KeyringOrigin,
                value: {
                  allowedOrigins: ['foo.com'],
                },
              },
            ],
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_DAPP_SUBJECT_METADATA,
      );

      const snap = snapController.getExpect(MOCK_SNAP_ID);
      await expect(
        snapController.handleRequest({
          snapId: snap.id,
          origin: 'bar.com',
          handler: HandlerType.OnKeyringRequest,
          request: { jsonrpc: '2.0', method: 'test' },
        }),
      ).rejects.toThrow(
        'Snap "npm:@metamask/example-snap" is not permitted to handle requests from "bar.com".',
      );

      snapController.destroy();
    });

    it('throws if onTransaction handler returns a phishing link', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.TransactionInsight]: {
            caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.TransactionInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () =>
          Promise.resolve({
            content: text('[Foo bar](https://foo.bar)'),
          }),
      );

      rootMessenger.registerActionHandler(
        'SnapInterfaceController:createInterface',
        () => {
          throw new Error('Invalid URL: The specified URL is not allowed.');
        },
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnTransaction,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow(`Invalid URL: The specified URL is not allowed.`);

      snapController.destroy();
    });

    it('throws if onTransaction returns an invalid value', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.TransactionInsight]: {
            caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.TransactionInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () =>
          Promise.resolve({
            content: text('[Foo bar](https://foo.bar)'),
            foo: 'bar',
          }),
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnTransaction,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow(
        'Assertion failed: Expected the value to satisfy a union of `object | object`, but received: [object Object].',
      );

      snapController.destroy();
    });

    it("doesn't throw if onTransaction return value is valid", async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handlerResponse = { content: text('[foobar](https://foo.bar)') };

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.TransactionInsight]: {
            caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.TransactionInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () => Promise.resolve(handlerResponse),
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnTransaction,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      });

      expect(result).toStrictEqual({ id: MOCK_INTERFACE_ID });

      snapController.destroy();
    });

    it('throws if onTransaction return value is an invalid id', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handlerResponse = { id: 'bar' };

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.TransactionInsight]: {
            caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.TransactionInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () => Promise.resolve(handlerResponse),
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnTransaction,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow("Interface with id 'bar' not found.");

      snapController.destroy();
    });

    it("doesn't throw if onTransaction return value is an id", async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handlerResponse = { id: 'bar' };

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.TransactionInsight]: {
            caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.TransactionInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () => Promise.resolve(handlerResponse),
      );

      rootMessenger.registerActionHandler(
        'SnapInterfaceController:getInterface',
        () => ({ snapId: MOCK_SNAP_ID, content: <Text>foo</Text>, state: {} }),
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnTransaction,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      });

      expect(result).toStrictEqual({ id: 'bar' });

      snapController.destroy();
    });

    it('throws if onSignature handler returns a phishing link', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.SignatureInsight]: {
            caveats: [{ type: SnapCaveatType.SignatureOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.SignatureInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () =>
          Promise.resolve({
            content: text('[Foo bar](https://foo.bar)'),
          }),
      );

      rootMessenger.registerActionHandler(
        'SnapInterfaceController:createInterface',
        () => {
          throw new Error('Invalid URL: The specified URL is not allowed.');
        },
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnSignature,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow(`Invalid URL: The specified URL is not allowed.`);

      snapController.destroy();
    });

    it('throws if onSignature returns an invalid value', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.SignatureInsight]: {
            caveats: [{ type: SnapCaveatType.SignatureOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.SignatureInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () =>
          Promise.resolve({
            content: text('[Foo bar](https://foo.bar)'),
            foo: 'bar',
          }),
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnSignature,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow(
        'Assertion failed: Expected the value to satisfy a union of `object | object`, but received: [object Object].',
      );

      snapController.destroy();
    });

    it('throws if onSignature return value is an invalid id', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handlerResponse = { id: 'bar' };

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.SignatureInsight]: {
            caveats: [{ type: SnapCaveatType.SignatureOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.SignatureInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () => Promise.resolve(handlerResponse),
      );

      await expect(
        snapController.handleRequest({
          snapId: MOCK_SNAP_ID,
          origin: 'foo.com',
          handler: HandlerType.OnSignature,
          request: {
            jsonrpc: '2.0',
            method: ' ',
            params: {},
            id: 1,
          },
        }),
      ).rejects.toThrow("Interface with id 'bar' not found.");

      snapController.destroy();
    });

    it("doesn't throw if onSignature return value is valid", async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handlerResponse = { content: text('[foobar](https://foo.bar)') };

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.SignatureInsight]: {
            caveats: [{ type: SnapCaveatType.SignatureOrigin, value: false }],
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: SnapEndowments.SignatureInsight,
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'SubjectMetadataController:getSubjectMetadata',
        () => MOCK_SNAP_SUBJECT_METADATA,
      );

      rootMessenger.registerActionHandler(
        'ExecutionService:handleRpcRequest',
        async () => Promise.resolve(handlerResponse),
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnSignature,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      });

      expect(result).toStrictEqual({ id: MOCK_INTERFACE_ID });

      snapController.destroy();
    });
  });

  it(`doesn't throw if onTransaction handler returns null`, async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.TransactionInsight]: {
          caveats: [{ type: SnapCaveatType.TransactionOrigin, value: false }],
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.TransactionInsight,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(null),
    );

    expect(
      await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnTransaction,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).toBeNull();

    snapController.destroy();
  });

  it(`doesn't throw if onSignature handler returns null`, async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.SignatureInsight]: {
          caveats: [{ type: SnapCaveatType.SignatureOrigin, value: false }],
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.SignatureInsight,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(null),
    );

    expect(
      await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnSignature,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).toBeNull();

    snapController.destroy();
  });

  it('throws if onHomePage handler returns a phishing link', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.HomePage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.HomePage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () =>
        Promise.resolve({
          content: text('[Foo bar](https://foo.bar)'),
        }),
    );

    rootMessenger.registerActionHandler(
      'SnapInterfaceController:createInterface',
      () => {
        throw new Error('Invalid URL: The specified URL is not allowed.');
      },
    );

    await expect(
      snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnHomePage,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`Invalid URL: The specified URL is not allowed.`);

    snapController.destroy();
  });

  it('throws if onHomePage return value is an invalid id', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const handlerResponse = { id: 'bar' };

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.HomePage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.HomePage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(handlerResponse),
    );

    await expect(
      snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnHomePage,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow("Interface with id 'bar' not found.");

    snapController.destroy();
  });

  it("doesn't throw if onHomePage return value is valid", async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const handlerResponse = { content: text('[foobar](https://foo.bar)') };

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.HomePage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.HomePage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(handlerResponse),
    );

    const result = await snapController.handleRequest({
      snapId: MOCK_SNAP_ID,
      origin: 'foo.com',
      handler: HandlerType.OnHomePage,
      request: {
        jsonrpc: '2.0',
        method: ' ',
        params: {},
        id: 1,
      },
    });

    expect(result).toStrictEqual({ id: MOCK_INTERFACE_ID });

    snapController.destroy();
  });

  it('throws if onSettingsPage handler returns a phishing link', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.SettingsPage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.SettingsPage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () =>
        Promise.resolve({
          content: text('[Foo bar](https://foo.bar)'),
        }),
    );

    rootMessenger.registerActionHandler(
      'SnapInterfaceController:createInterface',
      () => {
        throw new Error('Invalid URL: The specified URL is not allowed.');
      },
    );

    await expect(
      snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnSettingsPage,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(`Invalid URL: The specified URL is not allowed.`);

    snapController.destroy();
  });

  it('throws if onSettingsPage return value is an invalid id', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const handlerResponse = { id: 'bar' };

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.SettingsPage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.SettingsPage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(handlerResponse),
    );

    await expect(
      snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnSettingsPage,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow("Interface with id 'bar' not found.");

    snapController.destroy();
  });

  it("doesn't throw if onSettingsPage return value is valid", async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const handlerResponse = { content: text('[foobar](https://foo.bar)') };

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.SettingsPage]: {
          caveats: null,
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.SettingsPage,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(handlerResponse),
    );

    const result = await snapController.handleRequest({
      snapId: MOCK_SNAP_ID,
      origin: 'foo.com',
      handler: HandlerType.OnSettingsPage,
      request: {
        jsonrpc: '2.0',
        method: ' ',
        params: {},
        id: 1,
      },
    });

    expect(result).toStrictEqual({ id: MOCK_INTERFACE_ID });

    snapController.destroy();
  });

  it('throws if onNameLookup returns an invalid value', async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.NameLookup]: {
          caveats: [{ type: SnapCaveatType.ChainIds, value: ['eip155:1'] }],
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.NameLookup,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () =>
        Promise.resolve({
          foo: 'bar',
        }),
    );

    await expect(
      snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnNameLookup,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).rejects.toThrow(
      'Assertion failed: Expected the value to satisfy a union of `object | object`, but received: [object Object].',
    );

    snapController.destroy();
  });

  it("doesn't throw if onNameLookup return value is valid", async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    const handlerResponse = {
      resolvedAddresses: [
        {
          protocol: 'lens',
          resolvedAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          domainName: 'foobar',
        },
      ],
    };

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.NameLookup]: {
          caveats: [{ type: SnapCaveatType.ChainIds, value: ['eip155:1'] }],
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.NameLookup,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(handlerResponse),
    );

    const result = await snapController.handleRequest({
      snapId: MOCK_SNAP_ID,
      origin: 'foo.com',
      handler: HandlerType.OnNameLookup,
      request: {
        jsonrpc: '2.0',
        method: ' ',
        params: {},
        id: 1,
      },
    });

    expect(result).toBe(handlerResponse);

    snapController.destroy();
  });

  it(`doesn't throw if onNameLookup handler returns null`, async () => {
    const rootMessenger = getControllerMessenger();
    const messenger = getSnapControllerMessenger(rootMessenger);
    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => ({
        [SnapEndowments.NameLookup]: {
          caveats: [{ type: SnapCaveatType.ChainIds, value: ['eip155:1'] }],
          date: 1664187844588,
          id: 'izn0WGUO8cvq_jqvLQuQP',
          invoker: MOCK_SNAP_ID,
          parentCapability: SnapEndowments.NameLookup,
        },
      }),
    );

    rootMessenger.registerActionHandler(
      'SubjectMetadataController:getSubjectMetadata',
      () => MOCK_SNAP_SUBJECT_METADATA,
    );

    rootMessenger.registerActionHandler(
      'ExecutionService:handleRpcRequest',
      async () => Promise.resolve(null),
    );

    expect(
      await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnNameLookup,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {},
          id: 1,
        },
      }),
    ).toBeNull();

    snapController.destroy();
  });

  describe('getRpcRequestHandler', () => {
    it('handlers populate the "jsonrpc" property if missing', async () => {
      const rootMessenger = getControllerMessenger();
      const options = getSnapControllerWithEESOptions({
        rootMessenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      });
      const [snapController, service] = getSnapControllerWithEES(options);

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        (_origin, permission) => {
          return permission === SnapEndowments.Rpc;
        },
      );

      await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: 'foo.com',
        handler: HandlerType.OnRpcRequest,
        request: {
          jsonrpc: '2.0',
          method: 'bar',
          params: {},
          id: 1,
        },
      });

      expect(rootMessenger.call).toHaveBeenCalledTimes(4);
      expect(rootMessenger.call).toHaveBeenCalledWith(
        'ExecutionService:handleRpcRequest',
        MOCK_SNAP_ID,
        {
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            id: 1,
            method: 'bar',
            jsonrpc: '2.0',
            params: {},
          },
        },
      );

      await service.terminateAllSnaps();
      snapController.destroy();
    });

    it('handlers throw if the request has an invalid "jsonrpc" property', async () => {
      const fakeSnap = getPersistedSnapObject({ status: SnapStatus.Running });
      const snapId = fakeSnap.id;
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: {
              [snapId]: fakeSnap,
            },
          },
        }),
      );
      await expect(
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: 'kaplar',
            method: 'bar',
            id: 1,
          },
        }),
      ).rejects.toThrow(
        rpcErrors.invalidRequest({
          message:
            'Invalid JSON-RPC request: At path: jsonrpc -- Expected the literal `"2.0"`, but received: "kaplar".',
        }),
      );

      snapController.destroy();
    });

    it('handlers throw if the request is not valid JSON', async () => {
      const fakeSnap = getPersistedSnapObject({ status: SnapStatus.Running });
      const snapId = fakeSnap.id;
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: {
              [snapId]: fakeSnap,
            },
          },
        }),
      );
      await expect(
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            method: 'bar',
            params: BigInt(0),
          },
        }),
      ).rejects.toThrow(
        rpcErrors.invalidRequest({
          message:
            'Invalid JSON-RPC request: At path: params -- Expected the value to satisfy a union of `record | array`, but received: 0.',
        }),
      );

      snapController.destroy();
    });

    it('handlers will throw if there are too many pending requests before a snap has started', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const fakeSnap = getPersistedSnapObject({ status: SnapStatus.Stopped });
      const snapId = fakeSnap.id;
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [snapId]: fakeSnap,
            },
          },
        }),
      );

      let resolveExecutePromise: any;
      const deferredExecutePromise = new Promise((res) => {
        resolveExecutePromise = res;
      });

      rootMessenger.registerActionHandler(
        'ExecutionService:executeSnap',
        async () => deferredExecutePromise,
      );

      // Fill up the request queue
      const finishPromise = Promise.all([
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 1,
          },
        }),
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 2,
          },
        }),
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 3,
          },
        }),
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 4,
          },
        }),
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 5,
          },
        }),
      ]);

      await expect(
        snapController.handleRequest({
          snapId,
          origin: 'foo.com',
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'bar',
            params: {},
            id: 6,
          },
        }),
      ).rejects.toThrow(
        'Exceeds maximum number of requests waiting to be resolved, please try again.',
      );

      // Before processing the pending requests,
      // we need an rpc message handler function to be returned
      jest
        .spyOn(messenger, 'call')
        .mockImplementation((method, ..._args: unknown[]) => {
          if (method === 'ExecutionService:executeSnap') {
            return deferredExecutePromise;
          } else if (method === 'ExecutionService:handleRpcRequest') {
            return Promise.resolve(undefined);
          }
          return true;
        });

      // Resolve the promise that the pending requests are waiting for and wait for them to finish
      resolveExecutePromise();
      await finishPromise;

      snapController.destroy();
    });

    it('crashes the Snap on unhandled errors', async () => {
      const { manifest, sourceCode, svgIcon } =
        await getMockSnapFilesWithUpdatedChecksum({
          sourceCode: `
          module.exports.onRpcRequest = () => {
            throw new Error('foo');
          };
        `,
        });

      const [snapController, service] = getSnapControllerWithEES(
        getSnapControllerWithEESOptions({
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile],
          }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      await expect(
        snapController.handleRequest({
          origin: MOCK_ORIGIN,
          snapId: MOCK_SNAP_ID,
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'foo',
            params: {},
          },
        }),
      ).rejects.toThrow('foo');

      expect(snapController.state.snaps[MOCK_SNAP_ID].status).toBe('crashed');

      snapController.destroy();
      await service.terminateAllSnaps();
    });

    it('does not crash the Snap on handled errors', async () => {
      const { manifest, sourceCode, svgIcon } =
        await getMockSnapFilesWithUpdatedChecksum({
          sourceCode: `
          module.exports.onRpcRequest = () => {
            class SnapError {
              serialize() {
                return {
                  code: -31002,
                  message: 'Snap Error',
                  data: {
                    cause: {
                      code: -1,
                      message: 'foo',
                    },
                  },
                };
              }
            }

            throw new SnapError();
          };
        `,
        });

      const [snapController, service] = getSnapControllerWithEES(
        getSnapControllerWithEESOptions({
          idleTimeCheckInterval: 10,
          maxIdleTime: 50,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile],
          }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      await expect(
        snapController.handleRequest({
          origin: MOCK_ORIGIN,
          snapId: MOCK_SNAP_ID,
          handler: HandlerType.OnRpcRequest,
          request: {
            jsonrpc: '2.0',
            method: 'foo',
            params: {},
          },
        }),
      ).rejects.toThrow('foo');

      expect(snapController.state.snaps[MOCK_SNAP_ID].status).toBe('running');

      await sleep(100);

      // Should be terminated by idle timeout now
      expect(snapController.state.snaps[MOCK_SNAP_ID].status).toBe('stopped');

      snapController.destroy();
      await service.terminateAllSnaps();
    });
  });

  describe('installSnaps', () => {
    it('returns existing non-local snaps without reinstalling them', async () => {
      const messenger = getSnapControllerMessenger();
      const snapObject = getPersistedSnapObject();
      const truncatedSnap = getTruncatedSnap();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: snapObject,
            },
          },
        }),
      );

      const authorizeSpy = jest.spyOn(snapController as any, 'authorize');
      const result = await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });
      expect(result).toStrictEqual({ [MOCK_SNAP_ID]: truncatedSnap });

      expect(authorizeSpy).not.toHaveBeenCalled();

      snapController.destroy();
    });

    it('reinstalls local snaps even if they are already installed (already stopped)', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapObject = getPersistedSnapObject({
        id: MOCK_LOCAL_SNAP_ID,
      });
      const truncatedSnap = getTruncatedSnap({
        id: MOCK_LOCAL_SNAP_ID,
      });

      const location = new LoopbackLocation({
        manifest: snapObject.manifest,
        shouldAlwaysReload: true,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_LOCAL_SNAP_ID]: snapObject,
            },
          },
          detectSnapLocation: loopbackDetect(location),
        }),
      );

      const permissions = {
        ...getSnapManifest().initialPermissions,
        [SnapEndowments.Rpc]: {
          caveats: [
            { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
          ],
        },
      };

      const stopSnapSpy = jest.spyOn(snapController, 'stopSnap');

      const result = await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_LOCAL_SNAP_ID]: {},
      });

      expect(result).toStrictEqual({ [MOCK_LOCAL_SNAP_ID]: truncatedSnap });

      expect(messenger.call).toHaveBeenCalledTimes(12);

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_LOCAL_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        6,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            connections: {},
            permissions,
            loading: false,
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: permissions,
          subject: { origin: MOCK_LOCAL_SNAP_ID },
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_LOCAL_SNAP_ID,
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        8,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              origin: MOCK_LOCAL_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        9,
        'ExecutionService:executeSnap',
        expect.objectContaining({}),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        10,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_INSTALL,
          },
        }),
      );

      expect(location.manifest).toHaveBeenCalledTimes(1);

      expect(stopSnapSpy).not.toHaveBeenCalled();

      snapController.destroy();
    });

    it('reinstalls local snaps even if they are already installed (running)', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const version = '0.0.1';
      const newVersion = '0.0.2';

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({ version }),
      });
      const { manifest: newManifest } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({ version: newVersion }),
        });
      const truncatedSnap = getTruncatedSnap({
        version: newVersion,
        id: MOCK_LOCAL_SNAP_ID,
      });

      const location = new LoopbackLocation({ shouldAlwaysReload: true });
      location.manifest
        .mockImplementationOnce(async () => Promise.resolve(manifest))
        .mockImplementationOnce(async () => Promise.resolve(newManifest));

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect(location),
        }),
      );

      const permissions = {
        ...getSnapManifest().initialPermissions,
        [SnapEndowments.Rpc]: {
          caveats: [
            { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
          ],
        },
      };

      const stopSnapSpy = jest.spyOn(snapController, 'stopSnap');

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_LOCAL_SNAP_ID]: {},
      });
      expect(snapController.isRunning(MOCK_LOCAL_SNAP_ID)).toBe(true);

      const result = await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_LOCAL_SNAP_ID]: {},
      });
      expect(result).toStrictEqual({
        [MOCK_LOCAL_SNAP_ID]: truncatedSnap,
      });

      expect(messenger.call).toHaveBeenCalledTimes(23);

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_LOCAL_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            connections: {},
            permissions,
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        5,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: permissions,
          subject: { origin: MOCK_LOCAL_SNAP_ID },
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_LOCAL_SNAP_ID,
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        6,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_LOCAL_SNAP_ID,
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'ExecutionService:executeSnap',
        expect.anything(),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        8,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_INSTALL,
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        11,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_LOCAL_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        12,
        'ExecutionService:terminateSnap',
        MOCK_LOCAL_SNAP_ID,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        17,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            connections: {},
            permissions,
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        18,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: permissions,
          subject: { origin: MOCK_LOCAL_SNAP_ID },
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_LOCAL_SNAP_ID,
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        19,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_LOCAL_SNAP_ID,
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        20,
        'ExecutionService:executeSnap',
        expect.objectContaining({ snapId: MOCK_LOCAL_SNAP_ID }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        21,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_INSTALL,
          },
        }),
      );
      expect(stopSnapSpy).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });

    it('does not get stuck when re-installing a local snap that fails to install', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapObject = getPersistedSnapObject({
        id: MOCK_LOCAL_SNAP_ID,
      });

      const location = new LoopbackLocation({
        manifest: snapObject.manifest,
        shouldAlwaysReload: true,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_LOCAL_SNAP_ID]: snapObject,
            },
          },
          detectSnapLocation: loopbackDetect(location),
        }),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:addRequest',
        approvalControllerMock.addRequest.bind(approvalControllerMock),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:updateRequestState',
        approvalControllerMock.updateRequestStateAndReject.bind(
          approvalControllerMock,
        ),
      );

      await expect(
        snapController.installSnaps(MOCK_ORIGIN, {
          [MOCK_LOCAL_SNAP_ID]: {},
        }),
      ).rejects.toThrow('User rejected the request.');

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_LOCAL_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_LOCAL_SNAP_ID,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            error: providerErrors.userRejectedRequest().message,
            type: SNAP_APPROVAL_INSTALL,
          },
        }),
      );

      expect(snapController.state.snaps[MOCK_LOCAL_SNAP_ID]).toBeUndefined();

      snapController.destroy();
    });

    it('does not maintain existing permissions when re-installing local snap', async () => {
      const messenger = getSnapControllerMessenger();
      const snapObject = getPersistedSnapObject({
        id: MOCK_LOCAL_SNAP_ID,
      });

      const location = new LoopbackLocation({
        manifest: snapObject.manifest,
        shouldAlwaysReload: true,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_LOCAL_SNAP_ID]: snapObject,
            },
          },
          detectSnapLocation: loopbackDetect(location),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_LOCAL_SNAP_ID]: {},
      });

      expect(snapController.state.snaps[MOCK_LOCAL_SNAP_ID]).toBeDefined();

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:revokeAllPermissions',
        MOCK_LOCAL_SNAP_ID,
      );

      snapController.destroy();
    });

    it('grants connection permission to initialConnections', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const initialConnections = {
        'npm:filsnap': {},
        'https://snaps.metamask.io': {},
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialConnections,
        }),
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const approvedPermissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
              },
            },
          ],
        },
      };

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        { approvedPermissions, subject: { origin: 'npm:filsnap' } },
      );

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: 'https://snaps.metamask.io' },
        },
      );

      snapController.destroy();
    });

    it('updates existing caveats to satisfy initialConnections', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      const initialConnections = {
        'npm:filsnap': {},
        'https://snaps.metamask.io': {},
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialConnections,
        }),
      });

      const snapId = `${MOCK_SNAP_ID}_foo`;

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [snapId]: {},
      });

      const existingCaveatValue = MOCK_WALLET_SNAP_PERMISSION.caveats?.[0]
        .value as Record<string, Json>;

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:updateCaveat',
        'npm:filsnap',
        WALLET_SNAP_PERMISSION_KEY,
        SnapCaveatType.SnapIds,
        { ...existingCaveatValue, [snapId]: {} },
      );

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:updateCaveat',
        'https://snaps.metamask.io',
        WALLET_SNAP_PERMISSION_KEY,
        SnapCaveatType.SnapIds,
        { ...existingCaveatValue, [snapId]: {} },
      );

      snapController.destroy();
    });

    it('grants the `endowment:permitted-chains` permission to a Snap with `endowment:ethereum-provider`', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      rootMessenger.registerActionHandler(
        'SelectedNetworkController:getNetworkClientIdForDomain',
        () => 'mainnet',
      );

      rootMessenger.registerActionHandler(
        'NetworkController:getNetworkClientById',
        () => ({
          // @ts-expect-error - Partial network client.
          configuration: {
            chainId: '0x1',
          },
        }),
      );

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions: {
            'endowment:page-home': {},
            'endowment:ethereum-provider': {},
          },
        }),
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const approvedPermissions = {
        'endowment:page-home': {
          caveats: null,
        },
        'endowment:ethereum-provider': {},
        [PERMITTED_CHAINS_ENDOWMENT]: {
          caveats: [
            {
              type: 'restrictNetworkSwitching',
              value: ['0x1'],
            },
          ],
        },
      };

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: MOCK_SNAP_ID },
          requestData: expect.any(Object),
        },
      );

      snapController.destroy();
    });

    it('overrides the `endowment:permitted-chains` permission if the Snap specifies it in its manifest', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      rootMessenger.registerActionHandler(
        'SelectedNetworkController:getNetworkClientIdForDomain',
        () => 'mainnet',
      );

      rootMessenger.registerActionHandler(
        'NetworkController:getNetworkClientById',
        () => ({
          // @ts-expect-error - Partial network client.
          configuration: {
            chainId: '0x1',
          },
        }),
      );

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions: {
            'endowment:page-home': {},
            'endowment:ethereum-provider': {},
            [PERMITTED_CHAINS_ENDOWMENT]: {
              caveats: [
                {
                  type: 'restrictNetworkSwitching',
                  value: ['0x5'],
                },
              ],
            },
          },
        }),
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const approvedPermissions = {
        'endowment:page-home': {
          caveats: null,
        },
        'endowment:ethereum-provider': {},
        [PERMITTED_CHAINS_ENDOWMENT]: {
          caveats: [
            {
              type: 'restrictNetworkSwitching',
              value: ['0x1'],
            },
          ],
        },
      };

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: MOCK_SNAP_ID },
          requestData: expect.any(Object),
        },
      );

      snapController.destroy();
    });

    it('does not grant the `endowment:permitted-chains` permission if the Snap does not have the `endowment:ethereum-provider` permission', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      rootMessenger.registerActionHandler(
        'SelectedNetworkController:getNetworkClientIdForDomain',
        () => {
          throw new Error('This should not be called.');
        },
      );

      rootMessenger.registerActionHandler(
        'NetworkController:getNetworkClientById',
        () => {
          throw new Error('This should not be called.');
        },
      );

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions: {
            'endowment:page-home': {},
          },
        }),
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const approvedPermissions = {
        'endowment:page-home': {
          caveats: null,
        },
      };

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: MOCK_SNAP_ID },
          requestData: expect.any(Object),
        },
      );

      snapController.destroy();
    });

    it('supports preinstalled snaps', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');
      jest.spyOn(rootMessenger, 'publish');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            'endowment:rpc': {
              caveats: [
                { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_dialog: {},
          },
          subject: { origin: MOCK_SNAP_ID },
        },
      );

      expect(rootMessenger.publish).toHaveBeenCalledWith(
        'SnapController:snapInstalled',
        getTruncatedSnap(),
        'metamask',
        true,
      );

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => MOCK_SNAP_PERMISSIONS,
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
        request: { method: 'foo' },
        handler: HandlerType.OnRpcRequest,
      });

      expect(result).toContain('foo');

      snapController.destroy();
    });

    it('supports preinstalled snaps with initial connections', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const initialConnections = {
        'npm:filsnap': {},
        'https://snaps.metamask.io': {},
      };

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest({
            initialConnections,
          }),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      const approvedPermissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
              },
            },
          ],
        },
      };

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => MOCK_SNAP_PERMISSIONS,
      );

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        { approvedPermissions, subject: { origin: 'npm:filsnap' } },
      );

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: 'https://snaps.metamask.io' },
        },
      );

      snapController.destroy();
    });

    it('supports preinstalled snaps when Snap installation is disabled', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            'endowment:rpc': {
              caveats: [
                { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_dialog: {},
          },
          subject: { origin: MOCK_SNAP_ID },
        },
      );

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => MOCK_SNAP_PERMISSIONS,
      );

      expect(
        await snapController.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
      ).toStrictEqual({ [MOCK_SNAP_ID]: getTruncatedSnap() });

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
        request: { method: 'foo' },
        handler: HandlerType.OnRpcRequest,
      });

      expect(result).toContain('foo');

      snapController.destroy();
    });

    it('supports updating preinstalled snaps', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');
      jest.spyOn(rootMessenger, 'publish');

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest({
            version: '1.2.3',
            initialPermissions: {
              'endowment:rpc': { dapps: false, snaps: true },
              // eslint-disable-next-line @typescript-eslint/naming-convention
              snap_getEntropy: {},
            },
          }),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
        state: {
          snaps: getPersistedSnapsState(
            getPersistedSnapObject({ preinstalled: true }),
          ),
        },
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:revokePermissions',
        {
          [MOCK_SNAP_ID]: ['snap_dialog'],
        },
      );

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_getEntropy: {},
          },
          subject: { origin: MOCK_SNAP_ID },
        },
      );

      expect(rootMessenger.publish).toHaveBeenCalledWith(
        'SnapController:snapUpdated',
        getTruncatedSnap({
          version: '1.2.3',
          initialPermissions: {
            'endowment:rpc': { dapps: false, snaps: true },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_getEntropy: {},
          },
        }),
        '1.0.0',
        'metamask',
        true,
      );

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({
          [SnapEndowments.Rpc]: MOCK_SNAP_PERMISSIONS[SnapEndowments.Rpc],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          snap_getEntropy: {
            caveats: null,
            date: 1664187844588,
            id: 'izn0WGUO8cvq_jqvLQuQP',
            invoker: MOCK_SNAP_ID,
            parentCapability: 'snap_getEntropy',
          },
        }),
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
        request: { method: 'foo' },
        handler: HandlerType.OnRpcRequest,
      });

      expect(result).toContain('foo');

      snapController.destroy();
    });

    it('skips preinstalling a Snap if a newer version is already installed', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
        state: {
          snaps: getPersistedSnapsState(),
        },
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(rootMessenger.call).toHaveBeenCalledTimes(0);

      snapController.destroy();
    });

    it('supports localized preinstalled snaps', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          proposedName: '{{ proposedName }}',
          locales: ['locales/en.json'],
        }),
        localizationFiles: [getMockLocalizationFile()],
      });

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: manifest.result,
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
            {
              path: 'locales/en.json',
              value: stringToBytes(JSON.stringify(getMockLocalizationFile())),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(rootMessenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            'endowment:rpc': {
              caveats: [
                { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_dialog: {},
          },
          subject: { origin: MOCK_SNAP_ID },
        },
      );

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => MOCK_SNAP_PERMISSIONS,
      );

      const result = await snapController.handleRequest({
        snapId: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
        request: { method: 'foo' },
        handler: HandlerType.OnRpcRequest,
      });

      expect(result).toContain('foo');

      const {
        manifest: installedManifest,
        localizationFiles: installedLocalizationFiles,
      } = snapController.state.snaps[MOCK_SNAP_ID];

      assert(installedLocalizationFiles);
      const localizedManifest = getLocalizedSnapManifest(
        installedManifest,
        'en',
        installedLocalizationFiles,
      );

      expect(localizedManifest).toStrictEqual(
        getSnapManifest({
          proposedName: 'Example Snap',
          locales: ['locales/en.json'],
          shasum: manifest.result.source.shasum,
        }),
      );

      snapController.destroy();
    });

    it('disallows manual updates of preinstalled snaps', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permissions initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      // After install the snap should have permissions
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => MOCK_SNAP_PERMISSIONS,
      );

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });

      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });

      await expect(
        snapController.updateSnap(
          MOCK_ORIGIN,
          MOCK_SNAP_ID,
          detectSnapLocation(),
        ),
      ).rejects.toThrow('Preinstalled Snaps cannot be manually updated.');

      snapController.destroy();
    });

    it('supports preinstalled Snaps specifying the hidden flag', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          hidden: true,
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(snapController.get(MOCK_SNAP_ID)?.hidden).toBe(true);

      snapController.destroy();
    });

    it('supports preinstalled Snaps specifying the hideSnapBranding flag', async () => {
      const rootMessenger = getControllerMessenger();
      jest.spyOn(rootMessenger, 'call');

      // The snap should not have permission initially
      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      const preinstalledSnaps = [
        {
          snapId: MOCK_SNAP_ID,
          manifest: getSnapManifest(),
          hideSnapBranding: true,
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const snapControllerOptions = getSnapControllerWithEESOptions({
        preinstalledSnaps,
        rootMessenger,
      });
      const [snapController] = getSnapControllerWithEES(snapControllerOptions);

      expect(snapController.get(MOCK_SNAP_ID)?.hideSnapBranding).toBe(true);

      snapController.destroy();
    });

    it('authorizes permissions needed for snaps', async () => {
      const manifest = getSnapManifest();
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      const truncatedSnap = getTruncatedSnap({
        initialPermissions: manifest.initialPermissions,
      });

      const permissions = {
        ...getSnapManifest().initialPermissions,
        [SnapEndowments.Rpc]: {
          caveats: [
            { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
          ],
        },
      };

      const result = await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      expect(result).toStrictEqual({
        [MOCK_SNAP_ID]: truncatedSnap,
      });
      expect(messenger.call).toHaveBeenCalledTimes(10);

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_SNAP_ID,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            connections: {},
            permissions,
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        5,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: permissions,
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        6,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'ExecutionService:executeSnap',
        expect.objectContaining({}),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        8,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_INSTALL,
          },
        }),
      );

      snapController.destroy();
    });

    it('throws an error if a forbidden permission is requested', async () => {
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          snaps: false,
          dapps: true,
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'endowment:webassembly': {},
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions,
        }),
      });

      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
          // eslint-disable-next-line @typescript-eslint/naming-convention
          excludedPermissions: { 'endowment:webassembly': 'foobar' },
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
      ).rejects.toThrow('One or more permissions are not allowed:\nfoobar');

      controller.destroy();
    });

    it('throws an error if no handler permissions are requested', async () => {
      const initialPermissions = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        snap_dialog: {},
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions,
        }),
      });

      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
      ).rejects.toThrow(
        'A snap must request at least one of the following permissions: endowment:rpc, endowment:transaction-insight, endowment:cronjob, endowment:name-lookup, endowment:lifecycle-hooks, endowment:keyring, endowment:page-home, endowment:page-settings, endowment:signature-insight.',
      );

      controller.destroy();
    });

    it('does not throw an error if the manifest does not specify a platform version', async () => {
      const rawManifest = getSnapManifest();
      delete rawManifest.platformVersion;

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: rawManifest,
      });

      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
        // eslint-disable-next-line jest/no-restricted-matchers
      ).resolves.not.toThrow();

      controller.destroy();
    });

    it('throws an error if the specified platform version is newer than the supported platform version', async () => {
      const newerVersion = semver.inc(
        getPlatformVersion(),
        'minor',
      ) as SemVerVersion;

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          platformVersion: newerVersion,
        }),
      });

      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
      ).rejects.toThrow(
        `The Snap "${MOCK_SNAP_ID}" requires platform version "${newerVersion}" which is greater than the current platform version "${getPlatformVersion()}".`,
      );

      controller.destroy();
    });

    it('logs a warning if the specified platform version is newer than the supported platform version and `rejectInvalidPlatformVersion` is disabled', async () => {
      const log = jest.spyOn(console, 'warn').mockImplementation();

      const newerVersion = semver.inc(
        getPlatformVersion(),
        'minor',
      ) as SemVerVersion;

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          platformVersion: newerVersion,
        }),
      });

      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          featureFlags: {
            rejectInvalidPlatformVersion: false,
          },
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
        // eslint-disable-next-line jest/no-restricted-matchers
      ).resolves.not.toThrow();

      expect(log).toHaveBeenCalledWith(
        `The Snap "${MOCK_SNAP_ID}" requires platform version "${newerVersion}" which is greater than the current platform version "${getPlatformVersion()}".`,
      );

      controller.destroy();
    });

    it('maps permission caveats to the proper format', async () => {
      const initialPermissions = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'endowment:rpc': { snaps: false, dapps: true },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        snap_getBip32Entropy: [
          { path: ['m', "44'", "1'"], curve: 'secp256k1' as const },
        ],
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions,
        }),
      });

      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest: manifest.result,
          }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_SNAP_ID,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            connections: {},
            permissions: {
              [handlerEndowments.onRpcRequest as string]: {
                caveats: [
                  {
                    type: SnapCaveatType.RpcOrigin,
                    value: {
                      dapps: true,
                      snaps: false,
                    },
                  },
                ],
              },
              // eslint-disable-next-line @typescript-eslint/naming-convention
              snap_getBip32Entropy: {
                caveats: [
                  {
                    type: SnapCaveatType.PermittedDerivationPaths,
                    value: [{ path: ['m', "44'", "1'"], curve: 'secp256k1' }],
                  },
                ],
              },
            },
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        5,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            [handlerEndowments.onRpcRequest as string]: {
              caveats: [
                {
                  type: SnapCaveatType.RpcOrigin,
                  value: {
                    dapps: true,
                    snaps: false,
                  },
                },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_getBip32Entropy: {
              caveats: [
                {
                  type: SnapCaveatType.PermittedDerivationPaths,
                  value: [{ path: ['m', "44'", "1'"], curve: 'secp256k1' }],
                },
              ],
            },
          },
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_SNAP_ID,
          },
        },
      );

      snapController.destroy();
    });

    it('maps endowment permission caveats to the proper format', async () => {
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          snaps: false,
          dapps: true,
        },
      };
      const { manifest, sourceCode, svgIcon } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            version: '1.1.0' as SemVerVersion,
            initialPermissions,
          }),
        });

      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile],
          }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const caveat = {
        type: SnapCaveatType.RpcOrigin,
        value: {
          dapps: true,
          snaps: false,
        },
      };

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        expect.objectContaining({
          type: SNAP_APPROVAL_INSTALL,
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_SNAP_ID,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            connections: {},
            permissions: {
              [SnapEndowments.Rpc]: {
                caveats: [caveat],
              },
            },
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        5,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            [SnapEndowments.Rpc]: {
              caveats: [caveat],
            },
          },
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },
            snapId: MOCK_SNAP_ID,
          },
        },
      );

      snapController.destroy();
    });

    it('maps permission caveats to the proper format when updating snaps', async () => {
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          snaps: false,
          dapps: true,
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        snap_getBip32Entropy: [
          { path: ['m', "44'", "1'"], curve: 'secp256k1' as const },
        ],
      };
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
          initialPermissions,
        }),
      });

      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => ({}),
      );

      await snapController.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            [handlerEndowments.onRpcRequest as string]: {
              caveats: [
                {
                  type: SnapCaveatType.RpcOrigin,
                  value: {
                    dapps: true,
                    snaps: false,
                  },
                },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_getBip32Entropy: {
              caveats: [
                {
                  type: SnapCaveatType.PermittedDerivationPaths,
                  value: [{ path: ['m', "44'", "1'"], curve: 'secp256k1' }],
                },
              ],
            },
          },
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },

            snapId: MOCK_SNAP_ID,
          },
        },
      );

      snapController.destroy();
    });

    it('overwrites caveats on update for already approved permissions', async () => {
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          allowedOrigins: ['https://metamask.io'],
        },
      };
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
          initialPermissions,
        }),
      });

      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );

      await snapController.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        7,
        'PermissionController:revokePermissions',
        {
          [MOCK_SNAP_ID]: [SnapEndowments.Rpc, 'snap_dialog'],
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        8,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            [handlerEndowments.onRpcRequest as string]: {
              caveats: [
                {
                  type: SnapCaveatType.RpcOrigin,
                  value: {
                    allowedOrigins: ['https://metamask.io'],
                  },
                },
              ],
            },
          },
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              origin: MOCK_SNAP_ID,
              dappOrigin: MOCK_ORIGIN,
              id: expect.any(String),
            },

            snapId: MOCK_SNAP_ID,
          },
        },
      );

      snapController.destroy();
    });

    it('returns an error on invalid snap id', async () => {
      const snapId = 'foo';
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({ messenger }),
      );
      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [snapId]: {},
        }),
      ).rejects.toThrow(
        `Invalid snap ID: Expected the value to satisfy a union of \`intersection | string\`, but received: "foo".`,
      );

      controller.destroy();
    });

    it('updates a snap', async () => {
      const newVersion = '1.0.2';
      const newVersionRange = '>=1.0.1';

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: newVersion,
        }),
      });

      const detectLocationMock = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: getSnapManifest(),
            }),
        )
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest.result,
            }),
        );

      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: detectLocationMock,
        }),
      );

      await controller.installSnaps(MOCK_ORIGIN, { [MOCK_SNAP_ID]: {} });
      await controller.stopSnap(MOCK_SNAP_ID);

      (
        messenger.publish as jest.MockedFn<typeof messenger.publish>
      ).mockClear();

      const result = await controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: newVersionRange },
      });

      expect(messenger.call).toHaveBeenCalledTimes(21);

      expect(messenger.call).toHaveBeenNthCalledWith(
        3,
        'SubjectMetadataController:addSubjectMetadata',
        {
          subjectType: SubjectType.Snap,
          name: MOCK_SNAP_NAME,
          origin: MOCK_SNAP_ID,
          version: '1.0.0',
          svgIcon: DEFAULT_SNAP_ICON,
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        12,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_UPDATE,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        14,
        'PermissionController:getPermissions',
        MOCK_SNAP_ID,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        15,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            permissions: {},
            newVersion,
            newPermissions: {},
            approvedPermissions: MOCK_SNAP_PERMISSIONS,
            unusedPermissions: {},
            newConnections: {},
            unusedConnections: {},
            approvedConnections: {},
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        16,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        17,
        'SubjectMetadataController:addSubjectMetadata',
        {
          subjectType: SubjectType.Snap,
          name: MOCK_SNAP_NAME,
          origin: MOCK_SNAP_ID,
          version: '1.0.2',
          svgIcon: DEFAULT_SNAP_ICON,
        },
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        18,
        'ExecutionService:executeSnap',
        expect.objectContaining({}),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        19,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_UPDATE,
          },
        }),
      );

      expect(detectLocationMock).toHaveBeenCalledTimes(2);
      expect(detectLocationMock).toHaveBeenNthCalledWith(
        2,
        MOCK_SNAP_ID,
        expect.objectContaining({ versionRange: newVersionRange }),
      );

      expect(result).toStrictEqual({
        [MOCK_SNAP_ID]: getTruncatedSnap({
          version: newVersion,
        }),
      });

      expect(messenger.publish).not.toHaveBeenCalledWith(
        'SnapController:snapInstalled',
        expect.anything(),
      );

      expect(messenger.publish).not.toHaveBeenCalledWith(
        'SnapController:snapUpdated',
        expect.anything(),
      );

      controller.destroy();
    });

    it("returns an error when didn't update", async () => {
      // Scenario: a newer version is installed compared to requested version range
      const newVersion = '0.9.0';
      const newVersionRange = '^0.9.0';

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: newVersion,
        }),
      });
      const detect = loopbackDetect({
        manifest: manifest.result,
      });
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation: detect,
        }),
      );

      const errorMessage = `Snap "${MOCK_SNAP_ID}@1.0.0" is already installed. Couldn't update to a version inside requested "${newVersionRange}" range.`;

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: { version: newVersionRange },
        }),
      ).rejects.toThrow(errorMessage);

      expect(messenger.call).toHaveBeenCalledTimes(2);

      expect(messenger.call).toHaveBeenCalledWith(
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            error: errorMessage,
            type: SNAP_APPROVAL_UPDATE,
          },
        }),
      );
      expect(detect).toHaveBeenCalledTimes(1);
      expect(detect).toHaveBeenCalledWith(
        MOCK_SNAP_ID,
        expect.objectContaining({ versionRange: newVersionRange }),
      );

      controller.destroy();
    });

    it('returns an error when a throw happens inside an update', async () => {
      // Scenario: fetch fails
      const newVersionRange = '^1.0.1';

      const messenger = getSnapControllerMessenger();
      const location = new LoopbackLocation();
      location.manifest.mockImplementationOnce(async () =>
        Promise.reject(new Error('foo')),
      );
      const detect = loopbackDetect(location);
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation: detect,
        }),
      );

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: { version: newVersionRange },
        }),
      ).rejects.toThrow('foo');

      expect(messenger.call).toHaveBeenCalledTimes(2);
      expect(detect).toHaveBeenCalledTimes(1);
      expect(detect).toHaveBeenCalledWith(
        MOCK_SNAP_ID,
        expect.objectContaining({ versionRange: newVersionRange }),
      );

      controller.destroy();
    });

    it('rolls back any updates and installs made during a failure scenario', async () => {
      const snapId1 = 'npm:@metamask/example-snap1' as SnapId;
      const snapId2 = 'npm:@metamask/example-snap2' as SnapId;
      const snapId3 = 'npm:@metamask/example-snap3';
      const oldVersion = '1.0.0';
      const newVersion = '1.0.1';

      const manifest1 = (
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            version: newVersion,
          }),
        })
      ).manifest.result;

      const manifest2 = (
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            version: newVersion,
          }),
          sourceCode: 'foo',
        })
      ).manifest.result;

      const manifest = getSnapManifest();
      const detect = jest
        .fn()
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest1,
            }),
        )
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest2,
              files: [
                new VirtualFile({
                  value: 'foo',
                  path: manifest.source.location.npm.filePath,
                }),
                new VirtualFile({
                  value: DEFAULT_SNAP_ICON,
                  path: manifest.source.location.npm.iconPath,
                }),
              ],
            }),
        );

      const options = getSnapControllerWithEESOptions({
        detectSnapLocation: detect,
      });

      const { messenger } = options;

      const [controller, service] = getSnapControllerWithEES(options);

      await controller.installSnaps(MOCK_ORIGIN, { [snapId1]: {} });
      await controller.installSnaps(MOCK_ORIGIN, { [snapId2]: {} });
      await controller.stopSnap(snapId1);
      await controller.stopSnap(snapId2);

      expect(controller.get(snapId1)).toBeDefined();
      expect(controller.get(snapId2)).toBeDefined();

      (
        messenger.publish as jest.MockedFn<typeof messenger.publish>
      ).mockClear();

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [snapId3]: {},
          [snapId1]: { version: newVersion },
          [snapId2]: { version: newVersion },
        }),
      ).rejects.toThrow(`Snap ${snapId2} crashed with updated source code.`);

      expect(detect).toHaveBeenCalledTimes(5);

      expect(controller.get(snapId3)).toBeUndefined();
      expect(controller.get(snapId1)?.manifest.version).toBe(oldVersion);
      expect(controller.get(snapId2)?.manifest.version).toBe(oldVersion);
      expect(controller.get(snapId1)?.status).toBe('stopped');
      expect(controller.get(snapId2)?.status).toBe('stopped');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(messenger.publish).not.toHaveBeenCalledWith(
        'SnapController:snapInstalled',
        expect.anything(),
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(messenger.publish).not.toHaveBeenCalledWith(
        'SnapController:snapUpdated',
        expect.anything(),
      );

      controller.destroy();
      await service.terminateAllSnaps();
    });

    it('will not create snapshots for already installed snaps that have invalid requested ranges', async () => {
      const snapId1 = 'npm:@metamask/example-snap1' as SnapId;
      const snapId2 = 'npm:@metamask/example-snap2' as SnapId;
      const snapId3 = 'npm:@metamask/example-snap3';
      const oldVersion = '1.0.0';
      const newVersion = '1.0.1';
      const olderVersion = '0.9.0';

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: olderVersion,
        }),
      });
      const detect = jest
        .fn()
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest.result,
            }),
        );

      const options = getSnapControllerWithEESOptions({
        detectSnapLocation: detect,
      });
      const { messenger } = options;
      const [controller, service] = getSnapControllerWithEES(options);

      const listener = jest.fn();
      messenger.subscribe('SnapController:snapRolledback' as any, listener);

      await controller.installSnaps(MOCK_ORIGIN, { [snapId1]: {} });
      await controller.installSnaps(MOCK_ORIGIN, { [snapId2]: {} });
      await controller.stopSnap(snapId1);
      await controller.stopSnap(snapId2);

      expect(controller.get(snapId1)).toBeDefined();
      expect(controller.get(snapId2)).toBeDefined();

      await expect(
        controller.installSnaps(MOCK_ORIGIN, {
          [snapId3]: {},
          [snapId1]: { version: olderVersion },
          [snapId2]: { version: newVersion },
        }),
      ).rejects.toThrow(
        `Snap "${snapId1}@${oldVersion}" is already installed. Couldn't update to a version inside requested "${olderVersion}" range.`,
      );

      expect(detect).toHaveBeenCalledTimes(4);

      expect(controller.get(snapId3)).toBeUndefined();
      expect(controller.get(snapId1)?.manifest.version).toBe(oldVersion);
      expect(controller.get(snapId2)?.manifest.version).toBe(oldVersion);
      expect(listener).toHaveBeenCalledTimes(0);

      controller.destroy();
      await service.terminateAllSnaps();
    });

    it('handles unnormalized paths correctly', async () => {
      const { manifest, sourceCode, svgIcon } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            filePath: './bundle.js',
            iconPath: 'icon.svg',
          }),
          sourceCode: new VirtualFile({
            value: DEFAULT_SNAP_BUNDLE,
            path: 'bundle.js',
          }),
          svgIcon: new VirtualFile({
            value: DEFAULT_SNAP_ICON,
            path: 'icon.svg',
          }),
        });

      const controller = getSnapController(
        getSnapControllerOptions({
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile],
          }),
        }),
      );

      const result = await controller.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });
      expect((result[MOCK_SNAP_ID] as any).error).toBeUndefined();

      controller.destroy();
    });

    it('installs a snap with localization files', async () => {
      const messenger = getSnapControllerMessenger();
      const { manifest, sourceCode, svgIcon, localizationFiles } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            proposedName: '{{ proposedName }}',
            locales: ['locales/en.json'],
          }),
          localizationFiles: [getMockLocalizationFile()],
        });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile, ...localizationFiles],
          }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      const {
        manifest: installedManifest,
        localizationFiles: installedLocalizationFiles,
      } = snapController.state.snaps[MOCK_SNAP_ID];

      assert(installedLocalizationFiles);
      const localizedManifest = getLocalizedSnapManifest(
        installedManifest,
        'en',
        installedLocalizationFiles,
      );

      expect(localizedManifest).toStrictEqual(
        getSnapManifest({
          proposedName: 'Example Snap',
          locales: ['locales/en.json'],
          shasum: manifest.result.source.shasum,
        }),
      );

      snapController.destroy();
    });

    it('throws if the snap localization files are invalid', async () => {
      const messenger = getSnapControllerMessenger();
      const { manifest, sourceCode, svgIcon, localizationFiles } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            proposedName: '{{ proposedName }}',
            locales: ['locales/en.json'],
          }),
          localizationFiles: [getMockLocalizationFile({ messages: {} })],
        });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile, ...localizationFiles],
          }),
        }),
      );

      await expect(
        snapController.installSnaps(MOCK_ORIGIN, {
          [MOCK_SNAP_ID]: {},
        }),
      ).rejects.toThrow(
        'Failed to fetch snap "npm:@metamask/example-snap": Failed to localize Snap manifest: Failed to translate "{{ proposedName }}": No translation found for "proposedName" in "en" file.',
      );

      snapController.destroy();
    });
  });

  it('throws if the Snap source code is too large', async () => {
    const messenger = getSnapControllerMessenger();
    const { manifest, sourceCode, svgIcon, localizationFiles } =
      await getMockSnapFilesWithUpdatedChecksum({
        sourceCode: 'a'.repeat(64_000_001),
      });

    const snapController = getSnapController(
      getSnapControllerOptions({
        messenger,
        detectSnapLocation: loopbackDetect({
          manifest,
          files: [sourceCode, svgIcon as VirtualFile, ...localizationFiles],
        }),
      }),
    );

    await expect(
      snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      }),
    ).rejects.toThrow(
      'Failed to fetch snap "npm:@metamask/example-snap": Snap source code must be smaller than 64 MB..',
    );

    snapController.destroy();
  });

  describe('updateSnap', () => {
    it('throws an error for non installed snap', async () => {
      const detectSnapLocation = loopbackDetect();
      const controller = getSnapController();

      await expect(async () =>
        controller.updateSnap(
          MOCK_ORIGIN,
          MOCK_LOCAL_SNAP_ID,
          detectSnapLocation(),
        ),
      ).rejects.toThrow(`Snap "${MOCK_LOCAL_SNAP_ID}" not found.`);

      controller.destroy();
    });

    it('throws an error if the specified SemVer range is invalid', async () => {
      const detectSnapLocation = loopbackDetect();
      const controller = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      await expect(
        controller.updateSnap(
          MOCK_ORIGIN,
          MOCK_SNAP_ID,
          detectSnapLocation(),
          'this is not a version' as SemVerRange,
        ),
      ).rejects.toThrow(
        'Received invalid snap version range: "this is not a version".',
      );

      controller.destroy();
    });

    it("throws an error if new version doesn't match version range", async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );
      const onSnapUpdated = jest.fn();

      const snap = controller.getExpect(MOCK_SNAP_ID);

      messenger.subscribe('SnapController:snapUpdated', onSnapUpdated);

      const newSnap = controller.get(MOCK_SNAP_ID);

      await expect(
        async () =>
          await controller.updateSnap(
            MOCK_ORIGIN,
            MOCK_SNAP_ID,
            detectSnapLocation(),
            '1.2.0',
          ),
      ).rejects.toThrow(
        `Version mismatch. Manifest for "npm:@metamask/example-snap" specifies version "1.1.0" which doesn't satisfy requested version range "1.2.0".`,
      );
      expect(newSnap?.version).toStrictEqual(snap.version);
      expect(onSnapUpdated).not.toHaveBeenCalled();

      controller.destroy();
    });

    it('throws an error if the new version of the snap is blocked', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );

      registry.get.mockResolvedValueOnce({
        [MOCK_SNAP_ID]: { status: SnapsRegistryStatus.Blocked },
      });

      await expect(
        controller.updateSnap(MOCK_ORIGIN, MOCK_SNAP_ID, detectSnapLocation()),
      ).rejects.toThrow('Cannot install version "1.1.0" of snap');

      controller.destroy();
    });

    it('does not update on older snap version downloaded', async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '0.9.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );
      const onSnapUpdated = jest.fn();

      const snap = controller.getExpect(MOCK_SNAP_ID);

      messenger.subscribe('SnapController:snapUpdated', onSnapUpdated);

      const publishSpy = jest.spyOn(messenger, 'publish');

      const newSnap = controller.get(MOCK_SNAP_ID);

      const errorMessage = `Snap "${MOCK_SNAP_ID}@${snap.version}" is already installed. Couldn't update to a version inside requested "*" range.`;

      await expect(
        async () =>
          await controller.updateSnap(
            MOCK_ORIGIN,
            MOCK_SNAP_ID,
            detectSnapLocation(),
          ),
      ).rejects.toThrow(rpcErrors.invalidParams(errorMessage));
      expect(publishSpy).toHaveBeenCalledWith(
        'SnapController:snapInstallStarted',
        MOCK_SNAP_ID,
        MOCK_ORIGIN,
        true,
      );
      expect(newSnap?.version).toStrictEqual(snap.version);
      expect(onSnapUpdated).not.toHaveBeenCalled();
      expect(publishSpy).toHaveBeenCalledWith(
        'SnapController:snapInstallFailed',
        MOCK_SNAP_ID,
        MOCK_ORIGIN,
        true,
        errorMessage,
      );

      controller.destroy();
    });

    it('updates a snap', async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = jest
        .fn()
        .mockImplementationOnce(() => new LoopbackLocation())
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest.result,
            }),
        );
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation,
        }),
      );
      const callActionSpy = jest.spyOn(messenger, 'call');
      const publishSpy = jest.spyOn(messenger, 'publish');
      const onSnapUpdated = jest.fn();

      await controller.installSnaps(MOCK_ORIGIN, { [MOCK_SNAP_ID]: {} });
      await controller.stopSnap(MOCK_SNAP_ID);

      messenger.subscribe('SnapController:snapUpdated', onSnapUpdated);

      const result = await controller.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      const newSnapTruncated = controller.getTruncated(MOCK_SNAP_ID);

      const newSnap = controller.get(MOCK_SNAP_ID);

      expect(result).toStrictEqual(newSnapTruncated);
      expect(newSnap?.version).toBe('1.1.0');
      expect(newSnap?.versionHistory).toStrictEqual([
        {
          origin: MOCK_ORIGIN,
          version: '1.0.0',
          date: expect.any(Number),
        },
        {
          origin: MOCK_ORIGIN,
          version: '1.1.0',
          date: expect.any(Number),
        },
      ]);
      expect(callActionSpy).toHaveBeenCalledTimes(21);

      expect(callActionSpy).toHaveBeenNthCalledWith(
        12,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_UPDATE,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        14,
        'PermissionController:getPermissions',
        MOCK_SNAP_ID,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        15,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            permissions: {},
            newVersion: '1.1.0',
            newPermissions: {},
            approvedPermissions: MOCK_SNAP_PERMISSIONS,
            unusedPermissions: {},
            newConnections: {},
            unusedConnections: {},
            approvedConnections: {},
          },
        }),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        16,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        18,
        'ExecutionService:executeSnap',
        expect.objectContaining({}),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        21,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: { loading: false, type: SNAP_APPROVAL_UPDATE },
        }),
      );

      expect(publishSpy).toHaveBeenCalledWith(
        'SnapController:snapInstallStarted',
        MOCK_SNAP_ID,
        MOCK_ORIGIN,
        true,
      );
      expect(onSnapUpdated).toHaveBeenCalledTimes(1);
      expect(onSnapUpdated).toHaveBeenCalledWith(
        newSnapTruncated,
        '1.0.0',
        MOCK_ORIGIN,
        false,
      );

      controller.destroy();
    });

    it('can update crashed snap', async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = jest.fn().mockImplementation(
        () =>
          new LoopbackLocation({
            manifest: manifest.result,
          }),
      );
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({ status: SnapStatus.Crashed }),
            ),
          },
          detectSnapLocation,
        }),
      );

      const result = await controller.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      const newSnapTruncated = controller.getTruncated(MOCK_SNAP_ID);

      const newSnap = controller.get(MOCK_SNAP_ID);

      expect(result).toStrictEqual(newSnapTruncated);
      expect(newSnap?.version).toBe('1.1.0');
      expect(newSnap?.versionHistory).toStrictEqual([
        {
          origin: MOCK_ORIGIN,
          version: '1.0.0',
          date: expect.any(Number),
        },
        {
          origin: MOCK_ORIGIN,
          version: '1.1.0',
          date: expect.any(Number),
        },
      ]);
      expect(newSnap?.status).toBe(SnapStatus.Running);

      controller.destroy();
    });

    it('stops and restarts a running snap during an update', async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );
      const callActionSpy = jest.spyOn(messenger, 'call');

      await controller.startSnap(MOCK_SNAP_ID);

      const stopSnapSpy = jest.spyOn(controller as any, 'stopSnap');

      await controller.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      const isRunning = controller.isRunning(MOCK_SNAP_ID);

      expect(callActionSpy).toHaveBeenCalledTimes(12);

      expect(callActionSpy).toHaveBeenNthCalledWith(
        1,
        'ExecutionService:executeSnap',
        expect.objectContaining({ snapId: MOCK_SNAP_ID }),
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        2,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_UPDATE,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        4,
        'PermissionController:getPermissions',
        MOCK_SNAP_ID,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        5,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            permissions: {},
            newVersion: '1.1.0',
            newPermissions: {},
            approvedPermissions: MOCK_SNAP_PERMISSIONS,
            unusedPermissions: {},
            newConnections: {},
            unusedConnections: {},
            approvedConnections: {},
          },
        }),
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        6,
        'ApprovalController:addRequest',
        expect.objectContaining({
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        }),
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        7,
        'ExecutionService:terminateSnap',
        MOCK_SNAP_ID,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        12,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_UPDATE,
          },
        }),
      );
      expect(isRunning).toBe(true);
      expect(stopSnapSpy).toHaveBeenCalledTimes(1);

      controller.destroy();
    });

    it('throws on update request denied', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );
      const callActionSpy = jest.spyOn(messenger, 'call');
      const permissions = {
        ...getSnapManifest().initialPermissions,
        [SnapEndowments.Rpc]: {
          caveats: [
            { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
          ],
        },
      };

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => {
          return true;
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:addRequest',
        async (request) => {
          return approvalControllerMock.addRequest.bind(approvalControllerMock)(
            request,
          );
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:updateRequestState',
        (request) => {
          approvalControllerMock.updateRequestStateAndReject.bind(
            approvalControllerMock,
          )(request);
        },
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => {
          return {};
        },
      );

      await expect(
        controller.updateSnap(MOCK_ORIGIN, MOCK_SNAP_ID, detectSnapLocation()),
      ).rejects.toThrow('User rejected the request.');

      const newSnap = controller.get(MOCK_SNAP_ID);

      expect(newSnap?.version).toBe('1.0.0');
      expect(callActionSpy).toHaveBeenCalledTimes(5);

      expect(callActionSpy).toHaveBeenNthCalledWith(
        1,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_UPDATE,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        3,
        'PermissionController:getPermissions',
        MOCK_SNAP_ID,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        4,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            permissions,
            newVersion: '1.1.0',
            newPermissions: permissions,
            approvedPermissions: {},
            unusedPermissions: {},
            newConnections: {},
            unusedConnections: {},
            approvedConnections: {},
          },
        }),
      );

      controller.destroy();
    });

    it('requests approval for new and already approved permissions and revoke unused permissions', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      /* eslint-disable @typescript-eslint/naming-convention */
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          snaps: false,
          dapps: true,
        },
        snap_dialog: {},
        snap_manageState: {},
      };

      const approvedPermissions: SubjectPermissions<
        ValidPermission<string, Caveat<string, any>>
      > = {
        snap_dialog: {
          caveats: null,
          parentCapability: 'snap_dialog',
          id: '1',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
        snap_manageState: {
          caveats: null,
          parentCapability: 'snap_manageState',
          id: '2',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
        [handlerEndowments.onRpcRequest as string]: {
          caveats: [
            {
              type: SnapCaveatType.RpcOrigin,
              value: {
                dapps: true,
                snaps: false,
              },
            },
          ],
          parentCapability: handlerEndowments.onRpcRequest as string,
          id: '3',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
      };

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          initialPermissions,
        }),
      });

      const { manifest: manifest2 } = await getMockSnapFilesWithUpdatedChecksum(
        {
          manifest: getSnapManifest({
            version: '1.1.0' as SemVerRange,
            initialPermissions: {
              [handlerEndowments.onRpcRequest as string]: {
                snaps: false,
                dapps: true,
              },
              snap_dialog: {},
              'endowment:network-access': {},
            },
          }),
        },
      );

      const callActionSpy = jest.spyOn(messenger, 'call');

      const detect = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest.result,
            }),
        )
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest2.result,
            }),
        );

      const controller = getSnapController(
        getSnapControllerOptions({ messenger, detectSnapLocation: detect }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => {
          return true;
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:addRequest',
        async (request) => {
          return approvalControllerMock.addRequest.bind(approvalControllerMock)(
            request,
          );
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:updateRequestState',
        (request) => {
          approvalControllerMock.updateRequestStateAndApprove.bind(
            approvalControllerMock,
          )(request);
        },
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        (origin) => {
          if (origin === MOCK_ORIGIN) {
            return MOCK_ORIGIN_PERMISSIONS;
          }
          return approvedPermissions;
        },
      );

      await controller.installSnaps(MOCK_ORIGIN, { [MOCK_SNAP_ID]: {} });
      await controller.stopSnap(MOCK_SNAP_ID);

      await controller.updateSnap(MOCK_ORIGIN, MOCK_SNAP_ID, detect());

      expect(callActionSpy).toHaveBeenCalledTimes(23);

      expect(callActionSpy).toHaveBeenNthCalledWith(
        12,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_UPDATE,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        15,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            permissions: { 'endowment:network-access': {} },
            newVersion: '1.1.0',
            newPermissions: { 'endowment:network-access': {} },
            approvedPermissions: {
              [handlerEndowments.onRpcRequest as string]:
                approvedPermissions[handlerEndowments.onRpcRequest as string],
              snap_dialog: approvedPermissions.snap_dialog,
            },
            unusedPermissions: {
              snap_manageState: approvedPermissions.snap_manageState,
            },
            newConnections: {},
            unusedConnections: {},
            approvedConnections: {},
          },
        }),
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        16,
        'ApprovalController:addRequest',
        {
          origin: MOCK_ORIGIN,
          id: expect.any(String),
          type: SNAP_APPROVAL_RESULT,
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
          requestState: {
            loading: true,
          },
        },
        true,
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        18,
        'PermissionController:revokePermissions',
        { [MOCK_SNAP_ID]: ['snap_manageState'] },
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        19,
        'PermissionController:grantPermissions',
        {
          approvedPermissions: { 'endowment:network-access': {} },
          subject: { origin: MOCK_SNAP_ID },
          requestData: {
            metadata: {
              id: expect.any(String),
              dappOrigin: MOCK_ORIGIN,
              origin: MOCK_SNAP_ID,
            },
            snapId: MOCK_SNAP_ID,
          },
        },
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        20,
        'ExecutionService:executeSnap',
        expect.anything(),
      );

      expect(callActionSpy).toHaveBeenNthCalledWith(
        23,
        'ApprovalController:updateRequestState',
        expect.objectContaining({
          id: expect.any(String),
          requestState: {
            loading: false,
            type: SNAP_APPROVAL_UPDATE,
          },
        }),
      );

      controller.destroy();
    });

    it('supports initialConnections', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        (origin) => {
          if (origin === MOCK_SNAP_ID) {
            return MOCK_SNAP_PERMISSIONS;
          } else if (origin === MOCK_ORIGIN) {
            return MOCK_ORIGIN_PERMISSIONS;
          } else if (origin === 'https://metamask.io') {
            return {
              [WALLET_SNAP_PERMISSION_KEY]: {
                ...MOCK_WALLET_SNAP_PERMISSION,
                caveats: [
                  {
                    type: SnapCaveatType.SnapIds,
                    value: {
                      [MOCK_SNAP_ID]: {},
                    },
                  },
                ],
              },
            };
          }
          return {};
        },
      );

      // We wanna test that old pre-approved connections are revoked on update too.
      const previousInitialConnections = {
        'https://metamask.io': {},
      };

      const initialConnections = {
        [MOCK_ORIGIN]: {},
        'https://snaps.metamask.io': {},
        'npm:filsnap': {},
      };

      const { manifest: previousManifest } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            initialConnections: previousInitialConnections,
          }),
        });

      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.1.0' as SemVerVersion,
          initialConnections,
        }),
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({ manifest: previousManifest.result }),
            ),
          },
          detectSnapLocation: loopbackDetect({ manifest }),
        }),
      );

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: { version: '1.1.0' },
      });

      const approvedPermissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
              },
            },
          ],
        },
      };

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        { approvedPermissions, subject: { origin: 'npm:filsnap' } },
      );

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions,
          subject: { origin: 'https://snaps.metamask.io' },
        },
      );

      expect(messenger.call).toHaveBeenCalledWith(
        'PermissionController:revokePermissions',
        {
          'https://metamask.io': [WALLET_SNAP_PERMISSION_KEY],
        },
      );

      expect(messenger.call).not.toHaveBeenCalledWith(
        'PermissionController:updateCaveat',
        MOCK_ORIGIN,
        WALLET_SNAP_PERMISSION_KEY,
        SnapCaveatType.SnapIds,
        expect.objectContaining({ [MOCK_SNAP_ID]: {} }),
      );

      snapController.destroy();
    });

    it('assigns the same id to the approval request and the request metadata', async () => {
      expect.assertions(4);

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);

      /* eslint-disable @typescript-eslint/naming-convention */
      const initialPermissions = {
        [handlerEndowments.onRpcRequest as string]: {
          snaps: false,
          dapps: true,
        },
        snap_dialog: {},
        snap_manageState: {},
      };
      const approvedPermissions: SubjectPermissions<
        ValidPermission<string, Caveat<string, any>>
      > = {
        snap_dialog: {
          caveats: null,
          parentCapability: 'snap_dialog',
          id: '1',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
        snap_manageState: {
          caveats: null,
          parentCapability: 'snap_manageState',
          id: '2',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
        [handlerEndowments.onRpcRequest as string]: {
          caveats: [
            {
              type: SnapCaveatType.RpcOrigin,
              value: {
                dapps: true,
                snaps: false,
              },
            },
          ],
          parentCapability: handlerEndowments.onRpcRequest as string,
          id: '3',
          date: 1,
          invoker: MOCK_SNAP_ID,
        },
      };

      const manifest1 = (
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({ initialPermissions }),
        })
      ).manifest.result;

      const manifest2 = (
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({
            version: '1.1.0' as SemVerRange,
            initialPermissions: {
              [handlerEndowments.onRpcRequest as string]: {
                snaps: false,
                dapps: true,
              },
              snap_dialog: {},
              'endowment:network-access': {},
            },
          }),
        })
      ).manifest.result;

      const detect = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest1,
            }),
        )
        .mockImplementationOnce(
          () =>
            new LoopbackLocation({
              manifest: manifest2,
            }),
        );
      /* eslint-enable @typescript-eslint/naming-convention */

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: detect,
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => {
          return true;
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:addRequest',
        async (request) => {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(request.id).toBe(
            (request.requestData?.metadata as { id: string })?.id,
          );
          return approvalControllerMock.addRequest.bind(approvalControllerMock)(
            request,
          );
        },
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:updateRequestState',
        (request) => {
          approvalControllerMock.updateRequestStateAndApprove.bind(
            approvalControllerMock,
          )(request);
        },
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        (origin) => {
          if (origin === MOCK_ORIGIN) {
            return MOCK_ORIGIN_PERMISSIONS;
          }
          return approvedPermissions;
        },
      );

      await snapController.installSnaps(MOCK_ORIGIN, { [MOCK_SNAP_ID]: {} });
      await snapController.updateSnap(MOCK_ORIGIN, MOCK_SNAP_ID, detect());

      snapController.destroy();
    });

    it('handles unnormalized paths correctly', async () => {
      const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
        manifest: getSnapManifest({
          version: '1.2.0' as SemVerVersion,
          filePath: './dist/bundle.js',
          iconPath: './images/icon.svg',
        }),
      });
      const detectSnapLocation = loopbackDetect({
        manifest: manifest.result,
      });
      const messenger = getSnapControllerMessenger();
      const controller = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          detectSnapLocation,
        }),
      );

      await controller.updateSnap(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
        detectSnapLocation(),
      );

      const newSnap = controller.get(MOCK_SNAP_ID);
      expect(newSnap?.version).toBe('1.2.0');

      controller.destroy();
    });
  });

  describe('removeSnap', () => {
    it('will remove the "wallet_snap" permission from a subject that no longer has any permitted snaps', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const permissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          ...MOCK_WALLET_SNAP_PERMISSION,
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
              },
            },
          ],
        },
      };

      const callActionSpy = jest.spyOn(messenger, 'call');
      callActionSpy.mockImplementation((method, ..._args): any => {
        if (method === 'PermissionController:getSubjectNames') {
          return [MOCK_ORIGIN];
        } else if (method === 'PermissionController:getPermissions') {
          return permissions;
        }
        return undefined;
      });

      await snapController.removeSnap(MOCK_SNAP_ID);
      expect(callActionSpy).toHaveBeenCalledTimes(4);
      expect(callActionSpy).toHaveBeenNthCalledWith(
        4,
        'PermissionController:revokePermissions',
        {
          [MOCK_ORIGIN]: [WALLET_SNAP_PERMISSION_KEY],
        },
      );

      snapController.destroy();
    });

    it('will update the "wallet_snap" permission from a subject that has one or more permitted snaps', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject(),
              getPersistedSnapObject({
                id: `${MOCK_SNAP_ID}2` as SnapId,
              }),
            ),
          },
        }),
      );

      const permissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          ...MOCK_WALLET_SNAP_PERMISSION,
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
                [`${MOCK_SNAP_ID}2`]: {},
              },
            },
          ],
        },
      };

      const callActionSpy = jest.spyOn(messenger, 'call');
      callActionSpy.mockImplementation((method, ..._args): any => {
        if (method === 'PermissionController:getSubjectNames') {
          return [MOCK_ORIGIN];
        } else if (method === 'PermissionController:getPermissions') {
          return permissions;
        }
        return undefined;
      });

      await snapController.removeSnap(MOCK_SNAP_ID);
      expect(callActionSpy).toHaveBeenCalledTimes(4);
      expect(callActionSpy).toHaveBeenNthCalledWith(
        4,
        'PermissionController:updateCaveat',
        MOCK_ORIGIN,
        WALLET_SNAP_PERMISSION_KEY,
        SnapCaveatType.SnapIds,
        { [`${MOCK_SNAP_ID}2`]: {} },
      );

      snapController.destroy();
    });

    it("will skip subjects that don't have the snap permission", async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const permissions = {
        [WALLET_SNAP_PERMISSION_KEY]: {
          ...MOCK_WALLET_SNAP_PERMISSION,
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: {
                [MOCK_SNAP_ID]: {},
              },
            },
          ],
        },
      };

      const callActionSpy = jest.spyOn(messenger, 'call');
      callActionSpy.mockImplementation((method, ...args): any => {
        if (method === 'PermissionController:getSubjectNames') {
          return [MOCK_ORIGIN, MOCK_SNAP_ID];
        } else if (method === 'PermissionController:getPermissions') {
          if (args[0] === MOCK_ORIGIN) {
            return permissions;
          }

          return {};
        }
        return undefined;
      });

      await snapController.removeSnap(MOCK_SNAP_ID);
      expect(callActionSpy).toHaveBeenCalledTimes(5);
      expect(callActionSpy).toHaveBeenNthCalledWith(
        4,
        'PermissionController:revokePermissions',
        {
          [MOCK_ORIGIN]: [WALLET_SNAP_PERMISSION_KEY],
        },
      );
      expect(callActionSpy).not.toHaveBeenCalledWith(
        'PermissionController:revokePermissions',
        {
          [MOCK_SNAP_ID]: [WALLET_SNAP_PERMISSION_KEY],
        },
      );

      snapController.destroy();
    });

    it('removes snap state', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
            snapStates: {
              [MOCK_SNAP_ID]: 'foo',
            },
            unencryptedSnapStates: {
              [MOCK_SNAP_ID]: 'bar',
            },
          },
        }),
      );

      await snapController.removeSnap(MOCK_SNAP_ID);
      expect(snapController.state.snapStates).toStrictEqual({});
      expect(snapController.state.unencryptedSnapStates).toStrictEqual({});

      snapController.destroy();
    });
  });

  describe('enableSnap', () => {
    it('enables a disabled snap', () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({ enabled: false }),
            ),
          },
          messenger,
        }),
      );

      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(false);

      snapController.enableSnap(MOCK_SNAP_ID);
      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(true);
      expect(messenger.publish).toHaveBeenCalledWith(
        'SnapController:snapEnabled',
        getTruncatedSnap(),
      );

      snapController.destroy();
    });

    it('throws an error if the specified snap does not exist', () => {
      const snapController = getSnapController();
      expect(() => snapController.enableSnap(MOCK_SNAP_ID)).toThrow(
        `Snap "${MOCK_SNAP_ID}" not found.`,
      );

      snapController.destroy();
    });

    it('throws an error if the specified snap is blocked', () => {
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({ enabled: false, blocked: true }),
            ),
          },
        }),
      );

      expect(() => snapController.enableSnap(MOCK_SNAP_ID)).toThrow(
        `Snap "${MOCK_SNAP_ID}" is blocked and cannot be enabled.`,
      );

      snapController.destroy();
    });
  });

  describe('disableSnap', () => {
    it('disables a snap', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: getPersistedSnapsState(),
          },
          messenger,
        }),
      );

      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(true);

      await snapController.disableSnap(MOCK_SNAP_ID);
      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(false);
      expect(messenger.publish).toHaveBeenCalledWith(
        'SnapController:snapDisabled',
        getTruncatedSnap({ enabled: false }),
      );

      snapController.destroy();
    });

    it('stops a running snap when disabling it', async () => {
      const snapController = getSnapController(
        getSnapControllerOptions({
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(true);

      await snapController.startSnap(MOCK_SNAP_ID);
      expect(snapController.isRunning(MOCK_SNAP_ID)).toBe(true);

      await snapController.disableSnap(MOCK_SNAP_ID);
      expect(snapController.get(MOCK_SNAP_ID)?.enabled).toBe(false);
      expect(snapController.isRunning(MOCK_SNAP_ID)).toBe(false);

      snapController.destroy();
    });

    it('throws an error if the specified snap does not exist', async () => {
      const snapController = getSnapController();
      await expect(snapController.disableSnap(MOCK_SNAP_ID)).rejects.toThrow(
        `Snap "${MOCK_SNAP_ID}" not found.`,
      );

      snapController.destroy();
    });
  });

  describe('updateBlockedSnaps', () => {
    it('updates the registry database', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );
      await snapController.updateBlockedSnaps();

      expect(registry.update).toHaveBeenCalled();

      snapController.destroy();
    });

    it('blocks snaps as expected', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);
      const publishMock = jest.spyOn(messenger, 'publish');

      const mockSnapA = getMockSnapData({
        id: 'npm:exampleA' as SnapId,
        origin: 'foo.com',
      });

      const mockSnapB = getMockSnapData({
        id: 'npm:exampleB' as SnapId,
        origin: 'bar.io',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              mockSnapA.stateObject,
              mockSnapB.stateObject,
            ),
          },
        }),
      );

      const explanation = 'foo';
      const infoUrl = 'foobar.com';
      // Block snap A, ignore B.
      registry.get.mockResolvedValueOnce({
        [mockSnapA.id]: {
          status: SnapsRegistryStatus.Blocked,
          reason: { explanation, infoUrl },
        },
      });
      await snapController.updateBlockedSnaps();

      // Ensure that CheckSnapBlockListArg is correct
      expect(registry.get).toHaveBeenCalledWith({
        [mockSnapA.id]: {
          version: mockSnapA.manifest.version,
          checksum: mockSnapA.manifest.source.shasum,
        },
        [mockSnapB.id]: {
          version: mockSnapB.manifest.version,
          checksum: mockSnapB.manifest.source.shasum,
        },
      });

      // A is blocked and disabled
      expect(snapController.get(mockSnapA.id)?.blocked).toBe(true);
      expect(snapController.get(mockSnapA.id)?.enabled).toBe(false);

      // B is unblocked and enabled
      expect(snapController.get(mockSnapB.id)?.blocked).toBe(false);
      expect(snapController.get(mockSnapB.id)?.enabled).toBe(true);

      expect(publishMock).toHaveBeenLastCalledWith(
        'SnapController:snapBlocked',
        mockSnapA.id,
        {
          infoUrl,
          explanation,
        },
      );

      snapController.destroy();
    });

    it('stops running snaps when they are blocked', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);

      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      await snapController.startSnap(mockSnap.id);

      // Block the snap
      registry.get.mockResolvedValueOnce({
        [mockSnap.id]: { status: SnapsRegistryStatus.Blocked },
      });
      await snapController.updateBlockedSnaps();

      // The snap is blocked, disabled, and stopped
      expect(snapController.get(mockSnap.id)?.blocked).toBe(true);
      expect(snapController.get(mockSnap.id)?.enabled).toBe(false);
      expect(snapController.isRunning(mockSnap.id)).toBe(false);

      snapController.destroy();
    });

    it('unblocks snaps as expected', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);
      const publishMock = jest.spyOn(messenger, 'publish');

      const mockSnapA = getMockSnapData({
        id: 'npm:exampleA' as SnapId,
        origin: 'foo.com',
        blocked: true,
        enabled: false,
      });

      const mockSnapB = getMockSnapData({
        id: 'npm:exampleB' as SnapId,
        origin: 'bar.io',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              mockSnapA.stateObject,
              mockSnapB.stateObject,
            ),
          },
        }),
      );

      // A is blocked and disabled
      expect(snapController.get(mockSnapA.id)?.blocked).toBe(true);
      expect(snapController.get(mockSnapA.id)?.enabled).toBe(false);

      // B is unblocked and enabled
      expect(snapController.get(mockSnapB.id)?.blocked).toBe(false);
      expect(snapController.get(mockSnapB.id)?.enabled).toBe(true);

      // Indicate that both snaps A and B are unblocked, and update blocked
      // states.
      registry.get.mockResolvedValueOnce({
        [mockSnapA.id]: { status: SnapsRegistryStatus.Unverified },
        [mockSnapB.id]: { status: SnapsRegistryStatus.Unverified },
      });
      await snapController.updateBlockedSnaps();

      // A is unblocked, but still disabled
      expect(snapController.get(mockSnapA.id)?.blocked).toBe(false);
      expect(snapController.get(mockSnapA.id)?.enabled).toBe(false);

      // B remains unblocked and enabled
      expect(snapController.get(mockSnapB.id)?.blocked).toBe(false);
      expect(snapController.get(mockSnapB.id)?.enabled).toBe(true);

      expect(publishMock).toHaveBeenLastCalledWith(
        'SnapController:snapUnblocked',
        mockSnapA.id,
      );

      snapController.destroy();
    });

    it('updating blocked snaps does not throw if a snap is removed while fetching the blocklist', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);

      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      // Block the snap
      let resolveBlockListPromise: any;
      registry.get.mockReturnValueOnce(
        new Promise<unknown>((resolve) => (resolveBlockListPromise = resolve)),
      );

      const updateBlockList = snapController.updateBlockedSnaps();

      // Remove the snap while waiting for the blocklist
      await snapController.removeSnap(mockSnap.id);

      // Resolve the blocklist and wait for the call to complete
      resolveBlockListPromise({
        [mockSnap.id]: { status: SnapsRegistryStatus.Blocked },
      });
      await updateBlockList;

      // The snap was removed, no errors were thrown
      expect(snapController.has(mockSnap.id)).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      snapController.destroy();
    });

    it('logs but does not throw unexpected errors while blocking', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);

      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      await snapController.startSnap(mockSnap.id);

      jest.spyOn(snapController, 'stopSnap').mockImplementationOnce(() => {
        throw new Error('foo');
      });

      // Block the snap
      registry.get.mockResolvedValueOnce({
        [mockSnap.id]: { status: SnapsRegistryStatus.Blocked },
      });
      await snapController.updateBlockedSnaps();

      // A is blocked and disabled
      expect(snapController.get(mockSnap.id)?.blocked).toBe(true);
      expect(snapController.get(mockSnap.id)?.enabled).toBe(false);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Encountered error when stopping blocked snap "${mockSnap.id}".`,
        new Error('foo'),
      );

      snapController.destroy();
    });
  });

  describe('getRegistryMetadata', () => {
    it('returns the metadata for a verified snap', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);
      registry.getMetadata.mockReturnValue({
        name: 'Mock Snap',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      expect(
        await snapController.getRegistryMetadata(MOCK_SNAP_ID),
      ).toStrictEqual({
        name: 'Mock Snap',
      });

      snapController.destroy();
    });

    it('returns null for a non-verified snap', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      expect(await snapController.getRegistryMetadata(MOCK_SNAP_ID)).toBeNull();

      snapController.destroy();
    });
  });

  describe('clearState', () => {
    it('clears the state and terminates running snaps', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const callActionSpy = jest.spyOn(messenger, 'call');

      expect(snapController.has(MOCK_SNAP_ID)).toBe(true);

      await snapController.clearState();

      expect(snapController.has(MOCK_SNAP_ID)).toBe(false);

      expect(callActionSpy).toHaveBeenCalledWith(
        'ExecutionService:terminateAllSnaps',
      );

      expect(callActionSpy).toHaveBeenCalledWith(
        'PermissionController:revokeAllPermissions',
        MOCK_SNAP_ID,
      );

      snapController.destroy();
    });

    it('reinstalls preinstalled Snaps after clearing state', async () => {
      const preinstalledSnapId = `${MOCK_SNAP_ID}2` as SnapId;

      const preinstalledSnaps = [
        {
          snapId: preinstalledSnapId,
          manifest: getSnapManifest(),
          files: [
            {
              path: DEFAULT_SOURCE_PATH,
              value: stringToBytes(DEFAULT_SNAP_BUNDLE),
            },
            {
              path: DEFAULT_ICON_PATH,
              value: stringToBytes(DEFAULT_SNAP_ICON),
            },
          ],
        },
      ];

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          preinstalledSnaps,
        }),
      );

      const callActionSpy = jest.spyOn(messenger, 'call');

      expect(snapController.has(MOCK_SNAP_ID)).toBe(true);
      expect(snapController.has(preinstalledSnapId)).toBe(true);

      await snapController.clearState();

      expect(snapController.has(MOCK_SNAP_ID)).toBe(false);
      expect(snapController.has(preinstalledSnapId)).toBe(true);

      expect(callActionSpy).toHaveBeenCalledWith(
        'ExecutionService:terminateAllSnaps',
      );

      expect(callActionSpy).toHaveBeenCalledWith(
        'PermissionController:revokeAllPermissions',
        MOCK_SNAP_ID,
      );

      expect(callActionSpy).toHaveBeenCalledWith(
        'PermissionController:revokeAllPermissions',
        preinstalledSnapId,
      );

      expect(callActionSpy).toHaveBeenCalledWith(
        'PermissionController:grantPermissions',
        {
          approvedPermissions: {
            'endowment:rpc': {
              caveats: [
                { type: 'rpcOrigin', value: { dapps: false, snaps: true } },
              ],
            },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            snap_dialog: {},
          },
          subject: { origin: preinstalledSnapId },
        },
      );

      snapController.destroy();
    });
  });

  describe('SnapController actions', () => {
    describe('SnapController:get', () => {
      it('gets a snap', () => {
        const messenger = getSnapControllerMessenger();

        const snapController = getSnapController(
          getSnapControllerOptions({
            messenger,
            state: {
              snaps: getPersistedSnapsState(),
            },
          }),
        );

        const getSpy = jest.spyOn(snapController, 'get');
        const result = messenger.call('SnapController:get', MOCK_SNAP_ID);

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject(getSnapObject());

        snapController.destroy();
      });
    });

    describe('SnapController:handleRequest', () => {
      it('handles a snap RPC request', async () => {
        const messenger = getSnapControllerMessenger();

        const snapController = getSnapController(
          getSnapControllerOptions({
            messenger,
            state: {
              snaps: getPersistedSnapsState(),
            },
          }),
        );

        const handleRpcRequestSpy = jest
          .spyOn(snapController, 'handleRequest')
          .mockResolvedValueOnce(true);

        expect(
          await messenger.call('SnapController:handleRequest', {
            snapId: MOCK_SNAP_ID,
            handler: HandlerType.OnRpcRequest,
            origin: 'foo',
            request: {},
          }),
        ).toBe(true);
        expect(handleRpcRequestSpy).toHaveBeenCalledTimes(1);

        snapController.destroy();
      });
    });

    it('handles a transaction insight request', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handleRpcRequestSpy = jest
        .spyOn(snapController, 'handleRequest')
        .mockResolvedValueOnce(true);

      expect(
        await messenger.call('SnapController:handleRequest', {
          snapId: MOCK_SNAP_ID,
          handler: HandlerType.OnTransaction,
          origin: 'foo',
          request: {},
        }),
      ).toBe(true);
      expect(handleRpcRequestSpy).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });

    it('handles a signature insight request', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handleRpcRequestSpy = jest
        .spyOn(snapController, 'handleRequest')
        .mockResolvedValueOnce(true);

      expect(
        await messenger.call('SnapController:handleRequest', {
          snapId: MOCK_SNAP_ID,
          handler: HandlerType.OnSignature,
          origin: 'foo',
          request: {},
        }),
      ).toBe(true);
      expect(handleRpcRequestSpy).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });

    it('handles a name lookup request', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const handleRpcRequestSpy = jest
        .spyOn(snapController, 'handleRequest')
        .mockResolvedValueOnce(true);

      expect(
        await messenger.call('SnapController:handleRequest', {
          snapId: MOCK_SNAP_ID,
          handler: HandlerType.OnNameLookup,
          origin: '',
          request: {},
        }),
      ).toBe(true);
      expect(handleRpcRequestSpy).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });
  });

  describe('SnapController:getSnapState', () => {
    it(`gets the snap's state`, async () => {
      const messenger = getSnapControllerMessenger();

      const state = { myVariable: 1 };

      const mockEncryptedState = await encrypt(
        ENCRYPTION_KEY,
        state,
        undefined,
        undefined,
        DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      );

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
            snapStates: {
              [MOCK_SNAP_ID]: mockEncryptedState,
            },
          },
        }),
      );

      const getSnapStateSpy = jest.spyOn(snapController, 'getSnapState');
      const result = await messenger.call(
        'SnapController:getSnapState',
        MOCK_SNAP_ID,
        true,
      );

      expect(getSnapStateSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state);

      snapController.destroy();
    });

    it('migrates user storage to latest key derivation options', async () => {
      const messenger = getSnapControllerMessenger();

      const state = { myVariable: 1 };

      const initialEncryptedState = await encrypt(
        ENCRYPTION_KEY,
        state,
        undefined,
        undefined,
        {
          ...DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
          params: { iterations: 10_000 },
        },
      );

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
            snapStates: {
              [MOCK_SNAP_ID]: initialEncryptedState,
            },
          },
        }),
      );

      const newState = { myVariable: 2 };
      const promise = waitForStateChange(messenger);

      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        newState,
        true,
      );

      const upgradedEncryptedState = await encrypt(
        ENCRYPTION_KEY,
        newState,
        undefined,
        undefined,
        DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      );

      await promise;

      const result = await messenger.call(
        'SnapController:getSnapState',
        MOCK_SNAP_ID,
        true,
      );

      expect(result).toStrictEqual(newState);
      expect(snapController.state.snapStates[MOCK_SNAP_ID]).toStrictEqual(
        upgradedEncryptedState,
      );

      snapController.destroy();
    });

    it('uses different encryption keys for different snaps', async () => {
      const messenger = getSnapControllerMessenger();

      const state = { foo: 'bar' };

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
              [MOCK_LOCAL_SNAP_ID]: getPersistedSnapObject({
                id: MOCK_LOCAL_SNAP_ID,
              }),
            },
          },
        }),
      );

      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        state,
        true,
      );

      const promise = waitForStateChange(messenger);

      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_LOCAL_SNAP_ID,
        state,
        true,
      );

      await promise;

      const encryptedState1 = await encrypt(
        ENCRYPTION_KEY,
        state,
        undefined,
        undefined,
        DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      );

      const encryptedState2 = await encrypt(
        OTHER_ENCRYPTION_KEY,
        state,
        undefined,
        undefined,
        DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      );

      expect(snapController.state.snapStates[MOCK_SNAP_ID]).toStrictEqual(
        encryptedState1,
      );
      expect(snapController.state.snapStates[MOCK_LOCAL_SNAP_ID]).toStrictEqual(
        encryptedState2,
      );
      expect(snapController.state.snapStates[MOCK_SNAP_ID]).not.toStrictEqual(
        snapController.state.snapStates[MOCK_LOCAL_SNAP_ID],
      );

      snapController.destroy();
    });

    it('uses legacy decryption where needed', async () => {
      const messenger = getSnapControllerMessenger();

      const state = { foo: 'bar' };

      const { data, iv, salt } = JSON.parse(
        await encrypt(
          ENCRYPTION_KEY,
          state,
          undefined,
          undefined,
          LEGACY_ENCRYPTION_KEY_DERIVATION_OPTIONS,
        ),
      );

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
            snapStates: {
              [MOCK_SNAP_ID]: JSON.stringify({ data, iv, salt }),
            },
          },
        }),
      );

      expect(
        await messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
      ).toStrictEqual(state);

      snapController.destroy();
    });

    it('throws an error if the state is corrupt', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
            snapStates: {
              [MOCK_SNAP_ID]: 'foo',
            },
          },
        }),
      );

      await expect(
        messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
      ).rejects.toThrow(
        rpcErrors.internal({
          message: 'Failed to decrypt snap state, the state must be corrupted.',
        }),
      );

      snapController.destroy();
    });

    it(`gets the snap's unencrypted state`, async () => {
      const messenger = getSnapControllerMessenger();

      const state = { foo: 'bar' };

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
            unencryptedSnapStates: {
              [MOCK_SNAP_ID]: JSON.stringify(state),
            },
          },
        }),
      );

      const getSnapStateSpy = jest.spyOn(snapController, 'getSnapState');
      const result = await messenger.call(
        'SnapController:getSnapState',
        MOCK_SNAP_ID,
        false,
      );

      expect(getSnapStateSpy).toHaveBeenCalledTimes(1);
      expect(result).toStrictEqual(state);

      snapController.destroy();
    });

    it(`returns null if the Snap has no state yet`, async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: {
              [MOCK_SNAP_ID]: getPersistedSnapObject(),
            },
          },
        }),
      );

      expect(
        await messenger.call(
          'SnapController:getSnapState',
          MOCK_SNAP_ID,
          false,
        ),
      ).toBeNull();

      expect(
        await messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
      ).toBeNull();

      snapController.destroy();
    });
  });

  describe('SnapController:has', () => {
    it('checks if a snap exists in state', () => {
      const messenger = getSnapControllerMessenger();
      const id = 'npm:fooSnap' as SnapId;
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({
                version: '0.0.1',
                sourceCode: DEFAULT_SNAP_BUNDLE,
                id,
                manifest: getSnapManifest(),
                enabled: true,
                status: SnapStatus.Installing,
              }),
            ),
          },
        }),
      );

      const hasSpy = jest.spyOn(snapController, 'has');
      const result = messenger.call('SnapController:has', id);

      expect(hasSpy).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);

      snapController.destroy();
    });
  });

  describe('SnapController:updateSnapState', () => {
    it(`updates the snap's state`, async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const updateSnapStateSpy = jest.spyOn(snapController, 'updateSnapState');
      const state = { foo: 'bar' };
      const mockEncryptedState = await encrypt(
        ENCRYPTION_KEY,
        state,
        undefined,
        undefined,
        DEFAULT_ENCRYPTION_KEY_DERIVATION_OPTIONS,
      );

      const promise = waitForStateChange(messenger);
      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        state,
        true,
      );

      await promise;

      expect(updateSnapStateSpy).toHaveBeenCalledTimes(1);
      expect(snapController.state.snapStates[MOCK_SNAP_ID]).toStrictEqual(
        mockEncryptedState,
      );

      snapController.destroy();
    });

    it(`updates the snap's unencrypted state`, async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
        }),
      );

      const updateSnapStateSpy = jest.spyOn(snapController, 'updateSnapState');
      const state = { foo: 'bar' };
      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        state,
        false,
      );

      expect(updateSnapStateSpy).toHaveBeenCalledTimes(1);
      expect(
        snapController.state.unencryptedSnapStates[MOCK_SNAP_ID],
      ).toStrictEqual(JSON.stringify(state));

      snapController.destroy();
    });

    it('uses custom client cryptography functions', async () => {
      const messenger = getSnapControllerMessenger();

      const pbkdf2Sha512 = jest
        .fn()
        .mockResolvedValue(hexToBytes(ENCRYPTION_KEY));

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          clientCryptography: {
            pbkdf2Sha512,
          },
        }),
      );

      const state = { foo: 'bar' };

      const promise = waitForStateChange(messenger);
      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        state,
        true,
      );

      await promise;

      expect(pbkdf2Sha512).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });

    it('queues multiple state updates', async () => {
      const messenger = getSnapControllerMessenger();

      jest.useFakeTimers();

      const encryptor = getSnapControllerEncryptor();
      const { promise, resolve } = createDeferredPromise();
      const encryptWithKey = jest
        .fn<
          ReturnType<typeof encryptor.encryptWithKey>,
          Parameters<typeof encryptor.encryptWithKey>
        >()
        .mockImplementation(async (...args) => {
          resolve();
          await sleep(1);
          return await encryptor.encryptWithKey(...args);
        });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          encryptor: {
            ...getSnapControllerEncryptor(),
            // @ts-expect-error - Missing required properties.
            encryptWithKey,
          },
        }),
      );

      const firstStateChange = waitForStateChange(messenger);
      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        { foo: 'bar' },
        true,
      );

      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        { bar: 'baz' },
        true,
      );

      // We await this promise to ensure the timer is queued.
      await promise;
      jest.advanceTimersByTime(1);

      // After this point the second update should be queued.
      await firstStateChange;
      const secondStateChange = waitForStateChange(messenger);

      expect(encryptWithKey).toHaveBeenCalledTimes(1);

      // This is a bit hacky, but we can't simply advance the timer by 1ms
      // because the second timer is not running yet.
      jest.useRealTimers();
      await secondStateChange;

      expect(encryptWithKey).toHaveBeenCalledTimes(2);

      expect(
        await messenger.call('SnapController:getSnapState', MOCK_SNAP_ID, true),
      ).toStrictEqual({ bar: 'baz' });

      snapController.destroy();
    });

    it('logs an error message if the state fails to persist', async () => {
      const messenger = getSnapControllerMessenger();

      const errorValue = new Error('Failed to persist state.');
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          // @ts-expect-error - Missing required properties.
          encryptor: {
            ...getSnapControllerEncryptor(),
            encryptWithKey: jest.fn().mockRejectedValue(errorValue),
          },
        }),
      );

      const { promise, resolve } = createDeferredPromise();
      const error = jest.spyOn(console, 'error').mockImplementation(resolve);

      await messenger.call(
        'SnapController:updateSnapState',
        MOCK_SNAP_ID,
        { foo: 'bar' },
        true,
      );

      await promise;
      expect(error).toHaveBeenCalledWith(errorValue);

      snapController.destroy();
    });
  });

  describe('SnapController:clearSnapState', () => {
    it('clears the state of a snap', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snapStates: { [MOCK_SNAP_ID]: 'foo' },
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({
                status: SnapStatus.Installing,
              }),
            ),
          },
        }),
      );

      messenger.call('SnapController:clearSnapState', MOCK_SNAP_ID, true);
      const clearedState = await messenger.call(
        'SnapController:getSnapState',
        MOCK_SNAP_ID,
        true,
      );
      expect(clearedState).toBeNull();

      snapController.destroy();
    });

    it('clears the unencrypted state of a snap', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snapStates: { [MOCK_SNAP_ID]: 'foo' },
            snaps: getPersistedSnapsState(
              getPersistedSnapObject({
                status: SnapStatus.Installing,
              }),
            ),
          },
        }),
      );

      messenger.call('SnapController:clearSnapState', MOCK_SNAP_ID, false);
      const clearedState = await messenger.call(
        'SnapController:getSnapState',
        MOCK_SNAP_ID,
        false,
      );
      expect(clearedState).toBeNull();

      snapController.destroy();
    });

    it('logs an error message if the state fails to persist', async () => {
      const messenger = getSnapControllerMessenger();

      const errorValue = new Error('Failed to persist state.');
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(),
          },
          // @ts-expect-error - Missing required properties.
          encryptor: {
            ...getSnapControllerEncryptor(),
            encryptWithKey: jest.fn().mockRejectedValue(errorValue),
          },
        }),
      );

      const { promise, resolve } = createDeferredPromise();
      const error = jest.spyOn(console, 'error').mockImplementation(resolve);

      // @ts-expect-error - Property `update` is protected.
      // eslint-disable-next-line jest/prefer-spy-on
      snapController.update = jest.fn().mockImplementation(() => {
        throw errorValue;
      });

      await messenger.call('SnapController:clearSnapState', MOCK_SNAP_ID, true);

      await promise;
      expect(error).toHaveBeenCalledWith(errorValue);

      snapController.destroy();
    });
  });

  describe('SnapController:updateBlockedSnaps', () => {
    it('calls SnapController.updateBlockedSnaps()', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      const updateBlockedSnapsSpy = jest
        .spyOn(snapController, 'updateBlockedSnaps')
        .mockImplementation();

      await messenger.call('SnapController:updateBlockedSnaps');
      expect(updateBlockedSnapsSpy).toHaveBeenCalledTimes(1);

      snapController.destroy();
    });
  });

  describe('SnapController:enable', () => {
    it('calls SnapController.enableSnap()', () => {
      const messenger = getSnapControllerMessenger();
      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
        enabled: false,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      messenger.call('SnapController:enable', mockSnap.id);
      expect(snapController.state.snaps[mockSnap.id].enabled).toBe(true);

      snapController.destroy();
    });
  });

  describe('SnapController:disable', () => {
    it('calls SnapController.disableSnap()', async () => {
      const messenger = getSnapControllerMessenger();
      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
        enabled: true,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      await messenger.call('SnapController:disable', mockSnap.id);
      expect(snapController.state.snaps[mockSnap.id].enabled).toBe(false);

      snapController.destroy();
    });
  });

  describe('SnapController:remove', () => {
    it('calls SnapController.removeSnap()', async () => {
      const messenger = getSnapControllerMessenger();
      const mockSnap = getMockSnapData({
        id: 'npm:example' as SnapId,
        origin: 'foo.com',
        enabled: true,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      await messenger.call('SnapController:remove', mockSnap.id);
      expect(snapController.state.snaps[mockSnap.id]).toBeUndefined();

      snapController.destroy();
    });
  });

  describe('SnapController:getPermitted', () => {
    it('calls SnapController.getPermittedSnaps()', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const mockSnap = getMockSnapData({
        id: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      const result = await messenger.call(
        'SnapController:getPermitted',
        mockSnap.origin,
      );
      expect(result).toStrictEqual({
        [MOCK_SNAP_ID]: getTruncatedSnap(),
      });

      snapController.destroy();
    });
  });

  describe('SnapController:getAllSnaps', () => {
    it('calls SnapController.getAllSnaps()', () => {
      const messenger = getSnapControllerMessenger();
      const mockSnap = getMockSnapData({
        id: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(mockSnap.stateObject),
          },
        }),
      );

      const result = messenger.call('SnapController:getAll');
      expect(result).toStrictEqual([getTruncatedSnap()]);

      snapController.destroy();
    });
  });

  describe('SnapController:install', () => {
    it('calls SnapController.installSnaps()', async () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      const installSnapsSpy = jest
        .spyOn(snapController, 'installSnaps')
        .mockImplementation();

      const snaps = { [MOCK_SNAP_ID]: {} };
      await messenger.call('SnapController:install', 'foo', snaps);
      expect(installSnapsSpy).toHaveBeenCalledTimes(1);
      expect(installSnapsSpy).toHaveBeenCalledWith('foo', snaps);

      snapController.destroy();
    });
  });

  describe('SnapController:getRegistryMetadata', () => {
    it('calls SnapController.getRegistryMetadata()', async () => {
      const registry = new MockSnapsRegistry();
      const rootMessenger = getControllerMessenger(registry);
      const messenger = getSnapControllerMessenger(rootMessenger);

      registry.getMetadata.mockReturnValue({
        name: 'Mock Snap',
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      expect(
        await messenger.call(
          'SnapController:getRegistryMetadata',
          MOCK_SNAP_ID,
        ),
      ).toStrictEqual({
        name: 'Mock Snap',
      });

      snapController.destroy();
    });
  });

  describe('SnapController:disconnectOrigin', () => {
    it('calls SnapController.removeSnapFromSubject()', () => {
      const messenger = getSnapControllerMessenger();
      const permittedSnaps = [
        MOCK_SNAP_ID,
        MOCK_LOCAL_SNAP_ID,
        'foo',
        `${MOCK_SNAP_ID}1`,
        `${MOCK_SNAP_ID}2`,
        `${MOCK_SNAP_ID}3`,
      ];
      const snapObjects = permittedSnaps.map((snapId) =>
        getPersistedSnapObject({ id: snapId as SnapId }),
      );
      const snaps = getPersistedSnapsState(...snapObjects);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps,
          },
        }),
      );

      const removeSnapFromSubjectSpy = jest.spyOn(
        snapController,
        'removeSnapFromSubject',
      );

      const callActionSpy = jest.spyOn(messenger, 'call');

      messenger.call(
        'SnapController:disconnectOrigin',
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
      );
      expect(callActionSpy).toHaveBeenCalledTimes(3);
      expect(callActionSpy).toHaveBeenNthCalledWith(
        3,
        'PermissionController:updateCaveat',
        MOCK_ORIGIN,
        WALLET_SNAP_PERMISSION_KEY,
        SnapCaveatType.SnapIds,
        {
          [MOCK_LOCAL_SNAP_ID]: {},
          [`${MOCK_SNAP_ID}1`]: {},
          [`${MOCK_SNAP_ID}2`]: {},
          [`${MOCK_SNAP_ID}3`]: {},
        },
      );
      expect(removeSnapFromSubjectSpy).toHaveBeenCalledWith(
        MOCK_ORIGIN,
        MOCK_SNAP_ID,
      );

      snapController.destroy();
    });
  });

  describe('SnapController:revokeDynamicPermissions', () => {
    it('calls PermissionController:revokePermissions', () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      const callActionSpy = jest.spyOn(messenger, 'call');

      messenger.call('SnapController:revokeDynamicPermissions', MOCK_SNAP_ID, [
        'eth_accounts',
      ]);

      expect(callActionSpy).toHaveBeenCalledWith(
        'PermissionController:revokePermissions',
        { [MOCK_SNAP_ID]: ['eth_accounts'] },
      );

      snapController.destroy();
    });

    it('throws if input permission is not a dynamic permission', () => {
      const messenger = getSnapControllerMessenger();
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
        }),
      );

      expect(() =>
        messenger.call(
          'SnapController:revokeDynamicPermissions',
          MOCK_SNAP_ID,
          ['snap_notify'],
        ),
      ).toThrow('Non-dynamic permissions cannot be revoked');

      snapController.destroy();
    });
  });

  describe('SnapController:getFile', () => {
    it('calls SnapController.getSnapFile()', async () => {
      const auxiliaryFile = new VirtualFile({
        path: 'src/foo.json',
        value: stringToBytes('{ "foo" : "bar" }'),
      });
      const { manifest, sourceCode, svgIcon, auxiliaryFiles } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({ files: ['./src/foo.json'] }),
          auxiliaryFiles: [auxiliaryFile],
        });

      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile, ...auxiliaryFiles],
          }),
        }),
      );

      // By installing we also indirectly test that the unpacking of the file works.
      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      expect(
        await messenger.call(
          'SnapController:getFile',
          MOCK_SNAP_ID,
          './src/foo.json',
        ),
      ).toStrictEqual(auxiliaryFile.toString('base64'));

      snapController.destroy();
    });

    it('supports hex encoding', async () => {
      fetchMock.disableMocks();

      // We can remove this once we drop Node 18
      Object.defineProperty(globalThis, 'File', {
        value: File,
      });

      // Because jest-fetch-mock replaces native fetch, we mock it here
      Object.defineProperty(globalThis, 'fetch', {
        value: async (dataUrl: string) => {
          const base64 = dataUrl.replace(
            'data:application/octet-stream;base64,',
            '',
          );
          const u8 = base64ToBytes(base64);
          return new File([u8], '');
        },
      });

      const auxiliaryFile = new VirtualFile({
        path: 'src/foo.json',
        value: stringToBytes('{ "foo" : "bar" }'),
      });
      const { manifest, sourceCode, svgIcon, auxiliaryFiles } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({ files: ['./src/foo.json'] }),
          auxiliaryFiles: [auxiliaryFile],
        });

      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile, ...auxiliaryFiles],
          }),
        }),
      );

      // By installing we also indirectly test that the unpacking of the file works.
      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      expect(
        await messenger.call(
          'SnapController:getFile',
          MOCK_SNAP_ID,
          './src/foo.json',
          AuxiliaryFileEncoding.Hex,
        ),
      ).toStrictEqual(auxiliaryFile.toString('hex'));

      fetchMock.enableMocks();

      snapController.destroy();
    });

    it('returns null if file does not exist', async () => {
      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect(),
        }),
      );

      // By installing we also indirectly test that the unpacking of the file works.
      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      expect(
        await messenger.call(
          'SnapController:getFile',
          MOCK_SNAP_ID,
          './foo.json',
        ),
      ).toBeNull();

      snapController.destroy();
    });

    it('throws if encoding is too large', async () => {
      const auxiliaryFile = new VirtualFile({
        path: 'src/foo.json',
        value: new Uint8Array(32_000_000),
      });
      const { manifest, sourceCode, svgIcon, auxiliaryFiles } =
        await getMockSnapFilesWithUpdatedChecksum({
          manifest: getSnapManifest({ files: ['./src/foo.json'] }),
          auxiliaryFiles: [auxiliaryFile],
        });

      const messenger = getSnapControllerMessenger();

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          detectSnapLocation: loopbackDetect({
            manifest,
            files: [sourceCode, svgIcon as VirtualFile, ...auxiliaryFiles],
          }),
        }),
      );

      // Because jest-fetch-mock replaces native fetch, we mock it here
      Object.defineProperty(globalThis, 'fetch', {
        value: async (dataUrl: string) => {
          const base64 = dataUrl.replace(
            'data:application/octet-stream;base64,',
            '',
          );
          const u8 = base64ToBytes(base64);
          return new File([u8], '');
        },
      });

      await snapController.installSnaps(MOCK_ORIGIN, {
        [MOCK_SNAP_ID]: {},
      });

      await expect(
        messenger.call(
          'SnapController:getFile',
          MOCK_SNAP_ID,
          './src/foo.json',
          AuxiliaryFileEncoding.Hex,
        ),
      ).rejects.toThrow(
        'Failed to encode static file to "hex": Static files must be less than 64 MB when encoded.',
      );

      snapController.destroy();
    }, 60_000);
  });

  describe('SnapController:snapInstalled', () => {
    it('calls the `onInstall` lifecycle hook', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => {
          return {
            [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
          };
        },
      );

      messenger.publish(
        'SnapController:snapInstalled',
        getTruncatedSnap(),
        MOCK_ORIGIN,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'PermissionController:hasPermission',
        MOCK_SNAP_ID,
        SnapEndowments.LifecycleHooks,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        3,
        'ExecutionService:executeSnap',
        expect.any(Object),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ExecutionService:handleRpcRequest',
        MOCK_SNAP_ID,
        {
          handler: HandlerType.OnInstall,
          origin: MOCK_ORIGIN,
          request: {
            jsonrpc: '2.0',
            id: expect.any(String),
            method: HandlerType.OnInstall,
          },
        },
      );

      snapController.destroy();
    });

    it('does not call the `onInstall` lifecycle hook if the snap does not have the `endowment:lifecycle-hooks` permission', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => false,
      );

      messenger.publish(
        'SnapController:snapInstalled',
        getTruncatedSnap(),
        MOCK_ORIGIN,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(messenger.call).toHaveBeenCalledTimes(1);
      expect(messenger.call).not.toHaveBeenCalledWith(
        'ExecutionService:handleRpcRequest',
        MOCK_SNAP_ID,
        {
          handler: HandlerType.OnInstall,
          origin: '',
          request: {
            jsonrpc: '2.0',
            id: expect.any(String),
            method: HandlerType.OnInstall,
          },
        },
      );

      snapController.destroy();
    });

    it('logs an error if the lifecycle hook call fails', async () => {
      const log = jest.spyOn(console, 'error').mockImplementation();

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      const error = new Error('Failed to call lifecycle hook.');
      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => {
          throw error;
        },
      );

      messenger.publish(
        'SnapController:snapInstalled',
        getTruncatedSnap(),
        MOCK_ORIGIN,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(log).toHaveBeenCalledWith(
        `Error when calling \`onInstall\` lifecycle hook for snap "${MOCK_SNAP_ID}": ${error.message}`,
      );

      snapController.destroy();
    });
  });

  describe('SnapController:snapUpdated', () => {
    it('calls the `onUpdate` lifecycle hook', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:getPermissions',
        () => {
          return {
            [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
          };
        },
      );

      messenger.publish(
        'SnapController:snapUpdated',
        getTruncatedSnap(),
        '0.9.0',
        MOCK_ORIGIN,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(messenger.call).toHaveBeenNthCalledWith(
        1,
        'PermissionController:hasPermission',
        MOCK_SNAP_ID,
        SnapEndowments.LifecycleHooks,
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        3,
        'ExecutionService:executeSnap',
        expect.any(Object),
      );

      expect(messenger.call).toHaveBeenNthCalledWith(
        4,
        'ExecutionService:handleRpcRequest',
        MOCK_SNAP_ID,
        {
          handler: HandlerType.OnUpdate,
          origin: MOCK_ORIGIN,
          request: {
            jsonrpc: '2.0',
            id: expect.any(String),
            method: HandlerType.OnUpdate,
          },
        },
      );

      snapController.destroy();
    });

    it('does not call the `onUpdate` lifecycle hook if the snap does not have the `endowment:lifecycle-hooks` permission', async () => {
      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => false,
      );

      messenger.publish(
        'SnapController:snapInstalled',
        getTruncatedSnap(),
        MOCK_ORIGIN,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(messenger.call).toHaveBeenCalledTimes(1);
      expect(messenger.call).not.toHaveBeenCalledWith(
        'ExecutionService:handleRpcRequest',
        MOCK_SNAP_ID,
        {
          handler: HandlerType.OnUpdate,
          origin: '',
          request: {
            jsonrpc: '2.0',
            id: expect.any(String),
            method: HandlerType.OnUpdate,
          },
        },
      );

      snapController.destroy();
    });

    it('logs an error if the lifecycle hook call fails', async () => {
      const log = jest.spyOn(console, 'error').mockImplementation();

      const rootMessenger = getControllerMessenger();
      const messenger = getSnapControllerMessenger(rootMessenger);
      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(getPersistedSnapObject()),
          },
        }),
      );

      const error = new Error('Failed to call lifecycle hook.');
      rootMessenger.registerActionHandler(
        'PermissionController:hasPermission',
        () => {
          throw error;
        },
      );

      messenger.publish(
        'SnapController:snapUpdated',
        getTruncatedSnap(),
        '0.9.0',
        MOCK_ORIGIN,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(log).toHaveBeenCalledWith(
        `Error when calling \`onUpdate\` lifecycle hook for snap "${MOCK_SNAP_ID}": ${error.message}`,
      );

      snapController.destroy();
    });
  });

  describe('SnapController:stopAllSnaps', () => {
    it('calls SnapController.stopAllSnaps()', async () => {
      const messenger = getSnapControllerMessenger();
      const mockSnap = getMockSnapData({
        id: MOCK_SNAP_ID,
        origin: MOCK_ORIGIN,
      });
      const mockSnap2 = getMockSnapData({
        id: `${MOCK_SNAP_ID}2` as SnapId,
        origin: MOCK_ORIGIN,
      });

      const snapController = getSnapController(
        getSnapControllerOptions({
          messenger,
          state: {
            snaps: getPersistedSnapsState(
              mockSnap.stateObject,
              mockSnap2.stateObject,
            ),
          },
        }),
      );

      await snapController.startSnap(mockSnap.id);
      await snapController.startSnap(mockSnap2.id);

      await messenger.call('SnapController:stopAllSnaps');
      expect(snapController.state.snaps[mockSnap.id].status).toBe('stopped');
      expect(snapController.state.snaps[mockSnap2.id].status).toBe('stopped');

      snapController.destroy();
    });
  });
});
