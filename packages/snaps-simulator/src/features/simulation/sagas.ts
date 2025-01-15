import { ControllerMessenger } from '@metamask/base-controller';
import { createFetchMiddleware } from '@metamask/eth-json-rpc-middleware';
import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { createEngineStream } from '@metamask/json-rpc-middleware-stream';
import { mnemonicPhraseToBytes } from '@metamask/key-tree';
import type { GenericPermissionController } from '@metamask/permission-controller';
import {
  PermissionController,
  SubjectMetadataController,
  SubjectType,
} from '@metamask/permission-controller';
import type { StoredInterface } from '@metamask/snaps-controllers';
import {
  IframeExecutionService,
  SnapInterfaceController,
  setupMultiplex,
} from '@metamask/snaps-controllers';
import packageJson from '@metamask/snaps-execution-environments/package.json';
import {
  createSnapsMethodMiddleware,
  caveatSpecifications as snapsCaveatsSpecifications,
  endowmentCaveatSpecifications as snapsEndowmentCaveatSpecifications,
  processSnapPermissions,
  buildSnapEndowmentSpecifications,
  buildSnapRestrictedMethodSpecifications,
} from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import { type Component, type ComponentOrElement } from '@metamask/snaps-sdk';
import type {
  SnapManifest,
  SnapRpcHookArgs,
  VirtualFile,
} from '@metamask/snaps-utils';
import { logError, unwrapError } from '@metamask/snaps-utils';
import { getSafeJson, hasProperty, isObject } from '@metamask/utils';
import type { PayloadAction } from '@reduxjs/toolkit';
import { pipeline } from 'readable-stream';
import type { SagaIterator } from 'redux-saga';
import {
  all,
  call,
  put,
  select,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';

import { runSaga } from '../../store/middleware';
import { getSnapId, getSrp, setSnapId } from '../configuration';
import { addError } from '../console';
import { ManifestStatus, setValid } from '../manifest';
import { JSON_RPC_ENDPOINT } from './constants';
import {
  createInterface,
  getInterface,
  getInterfaceState,
  getSnapFile,
  getSnapState,
  showDialog,
  showInAppNotification,
  showNativeNotification,
  updateInterface,
  updateSnapState,
} from './hooks';
import { createMiscMethodMiddleware } from './middleware';
import {
  getExecutionService,
  setExecutionService,
  setSourceCode,
  sendRequest,
  SnapStatus,
  setStatus,
  getPermissionController,
  setManifest,
  setPermissionController,
  setSubjectMetadataController,
  getSubjectMetadataController,
  setSnapInterfaceController,
  setSnapInterface,
} from './slice';
import {
  ExcludedSnapEndowments,
  getEndowments,
  unrestrictedMethods,
} from './snap-permissions';

const DEFAULT_ENVIRONMENT_URL = `https://execution.metamask.io/iframe/${packageJson.version}/index.html`;

/**
 * Register the misc controller actions.
 *
 * @param controllerMessenger - The controller messenger.
 */
export function registerActions(
  controllerMessenger: ControllerMessenger<any, any>,
) {
  controllerMessenger.registerActionHandler(
    'PhishingController:testOrigin',
    () => ({ result: false }),
  );

  controllerMessenger.registerActionHandler(
    'PhishingController:maybeUpdateState',
    async () => Promise.resolve(),
  );
}

/**
 * The initialization saga is run on when the snap ID is changed and initializes the snaps execution environment.
 * This saga also creates the JSON-RPC engine and middlewares used to process RPC requests from the executing snap.
 *
 * @param action - The action itself.
 * @param action.payload - The payload of the action, in this case the snap ID.
 * @yields Puts the execution environment after creation.
 */
export function* initSaga({ payload }: PayloadAction<string>) {
  const controllerMessenger = new ControllerMessenger<any, any>();

  registerActions(controllerMessenger);

  const srp: string = yield select(getSrp);

  const sharedHooks = {
    getMnemonic: async () => mnemonicPhraseToBytes(srp),
  };

  const permissionSpecifications = {
    ...buildSnapEndowmentSpecifications(Object.keys(ExcludedSnapEndowments)),
    ...buildSnapRestrictedMethodSpecifications([], {
      ...sharedHooks,
      // TODO: Add all the hooks required
      // TODO: Allow changing this?
      getPreferences: () => ({
        locale: 'en',
        currency: 'usd',
        hideBalances: false,
      }),
      getUnlockPromise: async () => Promise.resolve(true),
      showDialog: async (...args: Parameters<typeof showDialog>) =>
        await runSaga(showDialog, ...args).toPromise(),
      showNativeNotification: async (
        ...args: Parameters<typeof showNativeNotification>
      ) => await runSaga(showNativeNotification, ...args).toPromise(),
      showInAppNotification: async (
        ...args: Parameters<typeof showInAppNotification>
      ) => await runSaga(showInAppNotification, ...args).toPromise(),
      getSnapState: (...args: Parameters<typeof getSnapState>) =>
        runSaga(getSnapState, ...args).result(),
      updateSnapState: async (...args: Parameters<typeof updateSnapState>) =>
        runSaga(updateSnapState, ...args).result(),
      clearSnapState: (...args: [_snapId: string, encrypted: boolean]) =>
        runSaga(updateSnapState, args[0], null, args[1]).result(),
      maybeUpdatePhishingList: async () => Promise.resolve(),
      // TODO: Allow changing this ?
      isOnPhishingList: () => false,
      createInterface: async (...args: Parameters<typeof createInterface>) =>
        await runSaga(createInterface, ...args).toPromise(),
      getInterface: (...args: Parameters<typeof getInterface>) =>
        runSaga(getInterface, ...args).result(),
    }),
  };

  const subjectMetadataController = new SubjectMetadataController({
    messenger: controllerMessenger.getRestricted({
      name: 'SubjectMetadataController',
      allowedActions: [],
      allowedEvents: [],
    }),
    subjectCacheLimit: 100,
  });

  const permissionController = new PermissionController({
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
      ] as any,
      allowedEvents: [],
    }),
    caveatSpecifications: {
      ...snapsCaveatsSpecifications,
      ...snapsEndowmentCaveatSpecifications,
    },
    permissionSpecifications,
    unrestrictedMethods,
  });

  const snapInterfaceController = new SnapInterfaceController({
    messenger: controllerMessenger.getRestricted({
      name: 'SnapInterfaceController',
      allowedActions: [
        `PhishingController:testOrigin`,
        `PhishingController:maybeUpdateState`,
      ],
      allowedEvents: [
        'NotificationServicesController:notificationsListUpdated',
      ],
    }),
  });

  const engine = new JsonRpcEngine();

  engine.push(createMiscMethodMiddleware(sharedHooks));

  engine.push(
    createSnapsMethodMiddleware(true, {
      getSnapFile: async (...args: Parameters<typeof getSnapFile>) =>
        await runSaga(getSnapFile, ...args).toPromise(),
      getIsLocked: () => false,
      createInterface: async (content: Component) =>
        await runSaga(createInterface, payload, content).toPromise(),
      getInterfaceState: (id: string) =>
        runSaga(getInterfaceState, payload, id).result(),
      getInterfaceContext: (id: string) =>
        runSaga(getInterface, payload, id).result().context,
      updateInterface: async (id: string, content: Component) =>
        await runSaga(updateInterface, payload, id, content).toPromise(),
    }),
  );

  engine.push(
    permissionController.createPermissionMiddleware({
      origin: payload,
    }),
  );

  engine.push(
    createFetchMiddleware({
      btoa: globalThis.btoa,
      fetch: globalThis.fetch,
      rpcUrl: JSON_RPC_ENDPOINT,
    }),
  );

  const searchParams = new URLSearchParams(window.location.search);
  const environmentUrl =
    searchParams.get('environment') ?? DEFAULT_ENVIRONMENT_URL;

  const executionService = new IframeExecutionService({
    iframeUrl: new URL(environmentUrl),
    messenger: controllerMessenger.getRestricted({
      name: 'ExecutionService',
      allowedActions: [],
      allowedEvents: [],
    }),
    setupSnapProvider: (_snapId, rpcStream) => {
      const mux = setupMultiplex(rpcStream, 'snapStream');
      const stream = mux.createStream('metamask-provider');
      const providerStream = createEngineStream({ engine });
      pipeline(stream, providerStream, stream, (error: unknown) => {
        if (error) {
          logError(`Provider stream failure.`, error);
        }
      });
    },
  });

  yield put(setExecutionService(executionService));
  yield put(setPermissionController(permissionController));
  yield put(setSubjectMetadataController(subjectMetadataController));
  yield put(setSnapInterfaceController(snapInterfaceController));
}

/**
 * The reboot saga, which should run when the setSourceCode action is emitted.
 * This saga will terminate existing snaps and reboot the snap with the latest source code.
 *
 * @param action - The action itself.
 * @param action.payload - The payload of the action, in this case the source code.
 * @yields Select for selecting the execution service and call to call the execution service.
 */
export function* rebootSaga({ payload }: PayloadAction<VirtualFile<string>>) {
  const snapId: string = yield select(getSnapId);
  const executionService: IframeExecutionService =
    yield select(getExecutionService);
  const permissionController: GenericPermissionController = yield select(
    getPermissionController,
  );

  const endowments: string[] = yield call(
    getEndowments,
    permissionController,
    snapId,
  );

  try {
    yield call([executionService, 'terminateAllSnaps']);
    yield call([executionService, 'executeSnap'], {
      snapId,
      sourceCode: payload.toString('utf8'),
      endowments,
    });
    yield put(setStatus(SnapStatus.Ok));
  } catch (error: any) {
    logError(error);
    yield put(addError(error));
    yield put(setStatus(SnapStatus.Error));
  }
}

/**
 * The request saga, which should run when the sendRequest action is emitted.
 * This saga will send an RPC request to the snap and capture the response.
 *
 * @param action - The action itself.
 * @param action.payload - The payload of the action, in this case the RPC request.
 * @yields Select for selecting the execution service, call to call the execution service and put for storing the response.
 */
export function* requestSaga({ payload }: PayloadAction<SnapRpcHookArgs>) {
  yield put({ type: `${payload.handler}/setRequest`, payload });

  const snapId: string = yield select(getSnapId);
  const executionService: IframeExecutionService =
    yield select(getExecutionService);

  try {
    const result: unknown = yield call(
      [executionService, 'handleRpcRequest'],
      snapId,
      payload,
    );

    if (isObject(result) && hasProperty(result, 'content')) {
      const interfaceId: string = yield call(
        createInterface,
        snapId,
        result.content as ComponentOrElement,
      );

      const snapInterface: StoredInterface = yield call(
        getInterface,
        snapId as SnapId,
        interfaceId,
      );

      yield put(setSnapInterface({ id: interfaceId, ...snapInterface }));

      yield put({
        type: `${payload.handler}/setResponse`,
        payload: {
          result: {
            ...snapInterface,
            id: interfaceId,
          },
        },
      });
    } else if (isObject(result) && hasProperty(result, 'id')) {
      const snapInterface: StoredInterface = yield call(
        getInterface,
        snapId as SnapId,
        result.id as string,
      );

      yield put(
        setSnapInterface({ id: result.id as string, ...snapInterface }),
      );
    }

    yield put({
      type: `${payload.handler}/setResponse`,
      payload: {
        result,
      },
    });
  } catch (error) {
    const [unwrappedError] = unwrapError(error);

    yield put({
      type: `${payload.handler}/setResponse`,
      payload: {
        error: unwrappedError.serialize(),
      },
    });
  }
}

/**
 * The permissions saga, which should run when the setManifest action is emitted.
 * This saga will automatically grant the active snap all permissions defined in the snap manifest.
 *
 * @param action - The action itself.
 * @param action.payload - The payload of the action, in this case a snap manifest.
 * @yields Selects the permission controller
 */
export function* permissionsSaga({
  payload,
}: PayloadAction<VirtualFile<SnapManifest>>): SagaIterator {
  try {
    const snapId: string = yield select(getSnapId);
    const subjectMetadataController: SubjectMetadataController = yield select(
      getSubjectMetadataController,
    );

    yield call([subjectMetadataController, 'addSubjectMetadata'], {
      origin: snapId,
      subjectType: SubjectType.Snap,
    });

    const permissionController: GenericPermissionController = yield select(
      getPermissionController,
    );

    // TODO: Verify these
    // Payload is frozen for unknown reasons, this breaks our superstruct validation.
    // To circumvent we stringify and parse.
    const approvedPermissions = processSnapPermissions(
      getSafeJson(payload.result.initialPermissions),
    );

    // Grant all permissions
    yield call([permissionController, 'grantPermissions'], {
      approvedPermissions,
      subject: { origin: snapId },
      preserveExistingPermissions: false,
    });
  } catch (error: any) {
    logError(error);
    yield put(addError(error));
    yield put(setStatus(SnapStatus.Error));
    yield put(setValid(ManifestStatus.Unknown));
  }
}

/**
 * The root simulation saga which runs all sagas in this file.
 *
 * @yields All sagas for the simulation feature.
 */
export function* simulationSaga() {
  yield all([
    takeLatest(setSnapId.type, initSaga),
    takeLatest(setSourceCode.type, rebootSaga),
    takeEvery(sendRequest.type, requestSaga),
    takeLatest(setManifest, permissionsSaga),
  ]);
}
