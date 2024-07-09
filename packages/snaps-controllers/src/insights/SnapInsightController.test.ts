import {
  getRestrictedSnapInsightControllerMessenger,
  getRootSnapInsightControllerMessenger,
  MOCK_INSIGHTS_PERMISSIONS,
  TRANSACTION_META_MOCK,
  PERSONAL_SIGNATURE_MOCK,
  TYPED_SIGNATURE_MOCK,
} from '../test-utils';
import { SnapInsightController } from './SnapInsightController';
import {
  getTruncatedSnap,
  MOCK_LOCAL_SNAP_ID,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';
import { nanoid } from 'nanoid';
import { HandlerType } from '@metamask/snaps-utils';

describe('SnapInsightController', () => {
  it('adds insight for transactions', async () => {
    const rootMessenger = getRootSnapInsightControllerMessenger();

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async () => {
        return { id: nanoid() };
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return MOCK_INSIGHTS_PERMISSIONS;
      },
    );

    const controllerMessenger =
      getRestrictedSnapInsightControllerMessenger(rootMessenger);

    const controller = new SnapInsightController({
      messenger: controllerMessenger,
    });

    rootMessenger.publish(
      'TransactionController:unapprovedTransactionAdded',
      TRANSACTION_META_MOCK,
    );

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(Object.values(controller.state.insights)[0]).toStrictEqual({
      loading: false,
      results: [
        { snapId: MOCK_SNAP_ID, response: { id: expect.any(String) } },
        { snapId: MOCK_LOCAL_SNAP_ID, response: { id: expect.any(String) } },
      ],
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(5);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            chainId: TRANSACTION_META_MOCK.chainId,
            transaction: TRANSACTION_META_MOCK.txParams,
            transactionOrigin: TRANSACTION_META_MOCK.origin,
          },
        },
      },
    );
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      5,
      'SnapController:handleRequest',
      {
        snapId: MOCK_LOCAL_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            chainId: TRANSACTION_META_MOCK.chainId,
            transaction: TRANSACTION_META_MOCK.txParams,
            transactionOrigin: TRANSACTION_META_MOCK.origin,
          },
        },
      },
    );
  });

  it('adds insight for personal sign', async () => {
    const rootMessenger = getRootSnapInsightControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightControllerMessenger(rootMessenger);

    const controller = new SnapInsightController({
      messenger: controllerMessenger,
    });

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async () => {
        return { id: nanoid() };
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return MOCK_INSIGHTS_PERMISSIONS;
      },
    );

    rootMessenger.publish(
      'SignatureController:stateChange',
      {
        unapprovedPersonalMsgCount: 1,
        unapprovedTypedMessagesCount: 0,
        unapprovedTypedMessages: {},
        unapprovedPersonalMsgs: { '1': PERSONAL_SIGNATURE_MOCK },
      },
      [],
    );

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(Object.values(controller.state.insights)[0]).toStrictEqual({
      loading: false,
      results: [
        { snapId: MOCK_SNAP_ID, response: { id: expect.any(String) } },
        { snapId: MOCK_LOCAL_SNAP_ID, response: { id: expect.any(String) } },
      ],
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(5);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            signature: {
              from: PERSONAL_SIGNATURE_MOCK.msgParams.from,
              data: PERSONAL_SIGNATURE_MOCK.msgParams.data,
              signatureMethod:
                PERSONAL_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: PERSONAL_SIGNATURE_MOCK.msgParams.origin,
          },
        },
      },
    );
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      5,
      'SnapController:handleRequest',
      {
        snapId: MOCK_LOCAL_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            signature: {
              from: PERSONAL_SIGNATURE_MOCK.msgParams.from,
              data: PERSONAL_SIGNATURE_MOCK.msgParams.data,
              signatureMethod:
                PERSONAL_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: PERSONAL_SIGNATURE_MOCK.msgParams.origin,
          },
        },
      },
    );
  });

  it('adds insight for typed signatures', async () => {
    const rootMessenger = getRootSnapInsightControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightControllerMessenger(rootMessenger);

    const controller = new SnapInsightController({
      messenger: controllerMessenger,
    });

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async () => {
        return { id: nanoid() };
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return MOCK_INSIGHTS_PERMISSIONS;
      },
    );

    rootMessenger.publish(
      'SignatureController:stateChange',
      {
        unapprovedPersonalMsgCount: 0,
        unapprovedTypedMessagesCount: 1,
        unapprovedTypedMessages: { '1': TYPED_SIGNATURE_MOCK },
        unapprovedPersonalMsgs: {},
      },
      [],
    );

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(Object.values(controller.state.insights)[0]).toStrictEqual({
      loading: false,
      results: [
        { snapId: MOCK_SNAP_ID, response: { id: expect.any(String) } },
        { snapId: MOCK_LOCAL_SNAP_ID, response: { id: expect.any(String) } },
      ],
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(5);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            signature: {
              from: TYPED_SIGNATURE_MOCK.msgParams.from,
              data: JSON.parse(TYPED_SIGNATURE_MOCK.msgParams.data),
              signatureMethod: TYPED_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: TYPED_SIGNATURE_MOCK.msgParams.origin,
          },
        },
      },
    );
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      5,
      'SnapController:handleRequest',
      {
        snapId: MOCK_LOCAL_SNAP_ID,
        origin: '',
        handler: HandlerType.OnTransaction,
        request: {
          method: '',
          params: {
            signature: {
              from: TYPED_SIGNATURE_MOCK.msgParams.from,
              data: JSON.parse(TYPED_SIGNATURE_MOCK.msgParams.data),
              signatureMethod: TYPED_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: TYPED_SIGNATURE_MOCK.msgParams.origin,
          },
        },
      },
    );
  });

  it('does not fetch signature insights if they are already fetched for a given signature', async () => {
    const rootMessenger = getRootSnapInsightControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightControllerMessenger(rootMessenger);

    const controller = new SnapInsightController({
      messenger: controllerMessenger,
    });

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async () => {
        return { id: nanoid() };
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return MOCK_INSIGHTS_PERMISSIONS;
      },
    );

    rootMessenger.publish(
      'SignatureController:stateChange',
      {
        unapprovedPersonalMsgCount: 0,
        unapprovedTypedMessagesCount: 1,
        unapprovedTypedMessages: { '1': TYPED_SIGNATURE_MOCK },
        unapprovedPersonalMsgs: {},
      },
      [],
    );

    rootMessenger.publish(
      'SignatureController:stateChange',
      {
        unapprovedPersonalMsgCount: 0,
        unapprovedTypedMessagesCount: 1,
        unapprovedTypedMessages: { '1': TYPED_SIGNATURE_MOCK },
        unapprovedPersonalMsgs: {},
      },
      [],
    );

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(Object.values(controller.state.insights)[0]).toStrictEqual({
      loading: false,
      results: [
        { snapId: MOCK_SNAP_ID, response: { id: expect.any(String) } },
        { snapId: MOCK_LOCAL_SNAP_ID, response: { id: expect.any(String) } },
      ],
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(8);
  });
});
