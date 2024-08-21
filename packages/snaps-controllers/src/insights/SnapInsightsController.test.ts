import { InternalError } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import {
  getTruncatedSnap,
  MOCK_LOCAL_SNAP_ID,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';
import { nanoid } from 'nanoid';

import { SnapInsightsController } from './SnapInsightsController';
import {
  getRestrictedSnapInsightsControllerMessenger,
  getRootSnapInsightsControllerMessenger,
  MOCK_INSIGHTS_PERMISSIONS,
  TRANSACTION_META_MOCK,
  PERSONAL_SIGNATURE_MOCK,
  TYPED_SIGNATURE_MOCK,
  MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS,
} from '../test-utils';

describe('SnapInsightsController', () => {
  it('adds insight for transactions', async () => {
    const rootMessenger = getRootSnapInsightsControllerMessenger();

    rootMessenger.registerActionHandler(
      'SnapInterfaceController:deleteInterface',
      () => {
        // no-op
      },
    );

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async ({ snapId }) => {
        if (snapId === MOCK_SNAP_ID) {
          return { id: nanoid() };
        }
        throw new InternalError();
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      (origin) => {
        return origin === MOCK_SNAP_ID
          ? MOCK_INSIGHTS_PERMISSIONS
          : MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS;
      },
    );

    const controllerMessenger =
      getRestrictedSnapInsightsControllerMessenger(rootMessenger);

    const controller = new SnapInsightsController({
      messenger: controllerMessenger,
    });

    rootMessenger.publish(
      'TransactionController:unapprovedTransactionAdded',
      TRANSACTION_META_MOCK,
    );

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(Object.values(controller.state.insights)[0]).toStrictEqual({
      [MOCK_SNAP_ID]: {
        snapId: MOCK_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
      [MOCK_LOCAL_SNAP_ID]: {
        snapId: MOCK_LOCAL_SNAP_ID,
        interfaceId: undefined,
        loading: false,
        error: 'Internal JSON-RPC error.',
        severity: undefined,
      },
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
            chainId: `eip155:${parseInt(TRANSACTION_META_MOCK.chainId, 16)}`,
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
            chainId: `eip155:${parseInt(TRANSACTION_META_MOCK.chainId, 16)}`,
            transaction: TRANSACTION_META_MOCK.txParams,
            transactionOrigin: null,
          },
        },
      },
    );

    // Simulate transaction signed & confirmed

    rootMessenger.publish('TransactionController:transactionStatusUpdated', {
      transactionMeta: { ...TRANSACTION_META_MOCK, status: 'approved' },
    });

    rootMessenger.publish('TransactionController:transactionStatusUpdated', {
      transactionMeta: { ...TRANSACTION_META_MOCK, status: 'confirmed' },
    });

    expect(Object.values(controller.state.insights)).toHaveLength(0);
    expect(rootMessenger.call).toHaveBeenCalledTimes(6);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      6,
      'SnapInterfaceController:deleteInterface',
      expect.any(String),
    );
  });

  it('adds insight for personal sign', async () => {
    const rootMessenger = getRootSnapInsightsControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightsControllerMessenger(rootMessenger);

    const controller = new SnapInsightsController({
      messenger: controllerMessenger,
    });

    rootMessenger.registerActionHandler(
      'SnapInterfaceController:deleteInterface',
      () => {
        // no-op
      },
    );

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap(), getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID })];
    });

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async ({ snapId }) => {
        if (snapId === MOCK_SNAP_ID) {
          return { id: nanoid() };
        }
        throw new InternalError();
      },
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      (origin) => {
        return origin === MOCK_SNAP_ID
          ? MOCK_INSIGHTS_PERMISSIONS
          : MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS;
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
      [MOCK_SNAP_ID]: {
        snapId: MOCK_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
      [MOCK_LOCAL_SNAP_ID]: {
        snapId: MOCK_LOCAL_SNAP_ID,
        interfaceId: undefined,
        loading: false,
        error: 'Internal JSON-RPC error.',
        severity: undefined,
      },
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(5);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnSignature,
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
        handler: HandlerType.OnSignature,
        request: {
          method: '',
          params: {
            signature: {
              from: PERSONAL_SIGNATURE_MOCK.msgParams.from,
              data: PERSONAL_SIGNATURE_MOCK.msgParams.data,
              signatureMethod:
                PERSONAL_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: null,
          },
        },
      },
    );

    // Simulate signature signed
    rootMessenger.publish(
      'SignatureController:stateChange',
      {
        unapprovedPersonalMsgCount: 0,
        unapprovedTypedMessagesCount: 0,
        unapprovedTypedMessages: {},
        unapprovedPersonalMsgs: {},
      },
      [],
    );

    expect(Object.values(controller.state.insights)).toHaveLength(0);
    expect(rootMessenger.call).toHaveBeenCalledTimes(6);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      6,
      'SnapInterfaceController:deleteInterface',
      expect.any(String),
    );
  });

  it('adds insight for typed signatures', async () => {
    const rootMessenger = getRootSnapInsightsControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightsControllerMessenger(rootMessenger);

    const controller = new SnapInsightsController({
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
      (origin) => {
        return origin === MOCK_SNAP_ID
          ? MOCK_INSIGHTS_PERMISSIONS
          : MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS;
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
      [MOCK_SNAP_ID]: {
        snapId: MOCK_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
      [MOCK_LOCAL_SNAP_ID]: {
        snapId: MOCK_LOCAL_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(5);
    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnSignature,
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
        handler: HandlerType.OnSignature,
        request: {
          method: '',
          params: {
            signature: {
              from: TYPED_SIGNATURE_MOCK.msgParams.from,
              data: JSON.parse(TYPED_SIGNATURE_MOCK.msgParams.data),
              signatureMethod: TYPED_SIGNATURE_MOCK.msgParams.signatureMethod,
            },
            signatureOrigin: null,
          },
        },
      },
    );
  });

  it('does not fetch signature insights if they are already fetched for a given signature', async () => {
    const rootMessenger = getRootSnapInsightsControllerMessenger();
    const controllerMessenger =
      getRestrictedSnapInsightsControllerMessenger(rootMessenger);

    const controller = new SnapInsightsController({
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
      (origin) => {
        return origin === MOCK_SNAP_ID
          ? MOCK_INSIGHTS_PERMISSIONS
          : MOCK_INSIGHTS_PERMISSIONS_NO_ORIGINS;
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
      [MOCK_SNAP_ID]: {
        snapId: MOCK_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
      [MOCK_LOCAL_SNAP_ID]: {
        snapId: MOCK_LOCAL_SNAP_ID,
        interfaceId: expect.any(String),
        loading: false,
        error: undefined,
        severity: undefined,
      },
    });

    expect(rootMessenger.call).toHaveBeenCalledTimes(8);
  });
});
