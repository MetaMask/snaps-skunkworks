import type { GenericPermissionController } from '@metamask/permission-controller';
import { processSnapPermissions } from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import { SnapError } from '@metamask/snaps-sdk';
import { Box } from '@metamask/snaps-sdk/jsx';
import {
  DEFAULT_ENDOWMENTS,
  HandlerType,
  WrappedSnapError,
} from '@metamask/snaps-utils';
import { expectSaga } from 'redux-saga-test-plan';
import { call } from 'redux-saga-test-plan/matchers';

import { createInterface, getInterface } from './hooks';
import { initSaga, permissionsSaga, rebootSaga, requestSaga } from './sagas';
import {
  sendRequest,
  setExecutionService,
  setManifest,
  setPermissionController,
  setSnapInterface,
  setSnapInterfaceController,
  setSourceCode,
} from './slice';
import { getSnapInterfaceController } from './test/controllers';
import { MockExecutionService } from './test/mockExecutionService';
import { MOCK_MANIFEST, MOCK_MANIFEST_FILE } from './test/mockManifest';
import { MOCK_SNAP_SOURCE, MOCK_SNAP_SOURCE_FILE } from './test/mockSnap';
import { DEFAULT_SRP, setSnapId } from '../configuration';

const snapId = 'local:http://localhost:8080';

describe('initSaga', () => {
  it('initializes the controllers', async () => {
    await expectSaga(initSaga, setSnapId(snapId))
      .withState({
        configuration: { srp: DEFAULT_SRP },
      })
      .put.actionType(setExecutionService.type)
      .put.actionType(setPermissionController.type)
      .put.actionType(setSnapInterfaceController.type)
      .silentRun();
  });
});

describe('rebootSaga', () => {
  it('reboots the execution environment when source code changes', async () => {
    const executionService = new MockExecutionService();
    const permissionController = {
      hasPermission: jest.fn().mockImplementation(() => true),
      getEndowments: jest.fn().mockResolvedValue([]),
    } as unknown as GenericPermissionController;
    await expectSaga(rebootSaga, setSourceCode(MOCK_SNAP_SOURCE_FILE))
      .withState({
        configuration: { snapId },
        simulation: { executionService, permissionController },
      })
      .call([executionService, 'terminateAllSnaps'])
      .call([executionService, 'executeSnap'], {
        snapId,
        sourceCode: MOCK_SNAP_SOURCE,
        endowments: DEFAULT_ENDOWMENTS,
      })
      .silentRun();
  });
});

describe('requestSaga', () => {
  it('sends requests to the execution environment and captures the response', async () => {
    const sourceCode = 'foo';
    const executionService = new MockExecutionService();
    const snapInterfaceController = getSnapInterfaceController();
    const request = {
      origin: 'Snaps Simulator',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'bar',
      },
    };
    await expectSaga(requestSaga, sendRequest(request))
      .withState({
        configuration: { snapId },
        simulation: { sourceCode, executionService, snapInterfaceController },
      })
      .put({
        type: `${HandlerType.OnRpcRequest}/setRequest`,
        payload: request,
      })
      .call([executionService, 'handleRpcRequest'], snapId, request)
      .put({
        type: `${HandlerType.OnRpcRequest}/setResponse`,
        payload: {
          result: 'foobar',
        },
      })
      .silentRun();
  });

  it('unwraps error responses', async () => {
    const sourceCode = 'foo';
    const executionService = new MockExecutionService();

    const error = new SnapError('foo');
    jest.spyOn(executionService, 'handleRpcRequest').mockImplementation(() => {
      throw new WrappedSnapError(error);
    });

    const request = {
      origin: 'Snaps Simulator',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'bar',
      },
    };

    await expectSaga(requestSaga, sendRequest(request))
      .withState({
        configuration: { snapId },
        simulation: { sourceCode, executionService },
      })
      .put({
        type: `${HandlerType.OnRpcRequest}/setRequest`,
        payload: request,
      })
      .call([executionService, 'handleRpcRequest'], snapId, request)
      .put.like({
        action: {
          type: `${HandlerType.OnRpcRequest}/setResponse`,
          payload: {
            error: {
              code: -32603,
              message: 'foo',
            },
          },
        },
      })
      .silentRun();
  });

  it('sets the interface id in the response', async () => {
    const sourceCode = 'foo';
    const executionService = new MockExecutionService();

    jest.spyOn(executionService, 'handleRpcRequest').mockImplementation(() => ({
      content: Box({ children: null }),
    }));
    const snapInterfaceController = getSnapInterfaceController();
    const request = {
      origin: 'Snaps Simulator',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'bar',
      },
    };

    const snapInterface = {
      snapId: snapId as SnapId,
      content: Box({ children: null }),
      state: {},
      context: null,
    };
    await expectSaga(requestSaga, sendRequest(request))
      .provide([
        [call.fn(createInterface), 'foo'],
        [call.fn(getInterface), snapInterface],
      ])
      .withState({
        configuration: { snapId },
        simulation: { sourceCode, executionService, snapInterfaceController },
      })
      .put({
        type: `${HandlerType.OnRpcRequest}/setRequest`,
        payload: request,
      })
      .call([executionService, 'handleRpcRequest'], snapId, request)
      .call(createInterface, snapId, Box({ children: null }))
      .call(getInterface, snapId, 'foo')
      .put(
        setSnapInterface({
          id: 'foo',
          ...snapInterface,
        }),
      )
      .put({
        type: `${HandlerType.OnRpcRequest}/setResponse`,
        payload: {
          result: { id: 'foo', ...snapInterface },
        },
      })
      .silentRun();
  });

  it('sets the interface content in the state if an interface Id is passed', async () => {
    const sourceCode = 'foo';
    const executionService = new MockExecutionService();

    jest.spyOn(executionService, 'handleRpcRequest').mockImplementation(() => ({
      id: 'foo',
    }));
    const snapInterfaceController = getSnapInterfaceController();
    const request = {
      origin: 'Snaps Simulator',
      handler: HandlerType.OnRpcRequest,
      request: {
        jsonrpc: '2.0',
        method: 'bar',
      },
    };

    const snapInterface = {
      snapId: snapId as SnapId,
      content: Box({ children: null }),
      state: {},
      context: null,
    };
    await expectSaga(requestSaga, sendRequest(request))
      .provide([[call.fn(getInterface), snapInterface]])
      .withState({
        configuration: { snapId },
        simulation: { sourceCode, executionService, snapInterfaceController },
      })
      .put({
        type: `${HandlerType.OnRpcRequest}/setRequest`,
        payload: request,
      })
      .call([executionService, 'handleRpcRequest'], snapId, request)
      .call(getInterface, snapId, 'foo')
      .put(
        setSnapInterface({
          id: 'foo',
          ...snapInterface,
        }),
      )
      .put({
        type: `${HandlerType.OnRpcRequest}/setResponse`,
        payload: {
          result: { id: 'foo' },
        },
      })
      .silentRun();
  });
});

describe('permissionsSaga', () => {
  it('grants permissions based on the manifest payload', async () => {
    const grantPermissions = jest.fn();
    const permissionController = {
      grantPermissions,
    } as unknown as GenericPermissionController;

    const subjectMetadataController = {
      addSubjectMetadata: jest.fn(),
    };

    const approvedPermissions = processSnapPermissions(
      MOCK_MANIFEST.initialPermissions,
    );

    await expectSaga(permissionsSaga, setManifest(MOCK_MANIFEST_FILE))
      .withState({
        configuration: { snapId },
        simulation: { subjectMetadataController, permissionController },
      })
      .call([permissionController, 'grantPermissions'], {
        approvedPermissions,
        subject: { origin: snapId },
        preserveExistingPermissions: false,
      })
      .silentRun();
  });
});
