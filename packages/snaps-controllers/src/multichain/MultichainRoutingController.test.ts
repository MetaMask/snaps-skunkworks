import { HandlerType } from '@metamask/snaps-utils';
import { getTruncatedSnap } from '@metamask/snaps-utils/test-utils';

import {
  getRootMultichainRoutingControllerMessenger,
  getRestrictedMultichainRoutingControllerMessenger,
  BTC_CAIP2,
  BTC_CONNECTED_ACCOUNTS,
  MOCK_SOLANA_SNAP_PERMISSIONS,
  SOLANA_CONNECTED_ACCOUNTS,
  SOLANA_CAIP2,
  MOCK_SOLANA_ACCOUNTS,
  MOCK_BTC_ACCOUNTS,
} from '../test-utils';
import { MultichainRoutingController } from './MultichainRoutingController';

describe('MultichainRoutingController', () => {
  it('can route signing requests to account Snaps without address resolution', async () => {
    const rootMessenger = getRootMultichainRoutingControllerMessenger();
    const messenger =
      getRestrictedMultichainRoutingControllerMessenger(rootMessenger);

    /* eslint-disable-next-line no-new */
    new MultichainRoutingController({
      messenger,
    });

    rootMessenger.registerActionHandler(
      'AccountsController:listMultichainAccounts',
      () => MOCK_BTC_ACCOUNTS,
    );

    rootMessenger.registerActionHandler(
      'KeyringController:submitNonEvmRequest',
      async () => ({
        txid: '53de51e2fa75c3cfa51132865f7d430138b1cd92a8f5267ec836ec565b422969',
      }),
    );

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async ({ handler }) => {
        if (handler === HandlerType.OnKeyringRequest) {
          return null;
        }
        throw new Error('Unmocked request');
      },
    );

    const result = await messenger.call(
      'MultichainRoutingController:handleRequest',
      {
        connectedAddresses: BTC_CONNECTED_ACCOUNTS,
        scope: BTC_CAIP2,
        request: {
          method: 'btc_sendmany',
          params: {
            message: 'foo',
          },
        },
      },
    );

    expect(result).toStrictEqual({
      txid: '53de51e2fa75c3cfa51132865f7d430138b1cd92a8f5267ec836ec565b422969',
    });
  });

  it('can route signing requests to account Snaps using address resolution', async () => {
    const rootMessenger = getRootMultichainRoutingControllerMessenger();
    const messenger =
      getRestrictedMultichainRoutingControllerMessenger(rootMessenger);

    /* eslint-disable-next-line no-new */
    new MultichainRoutingController({
      messenger,
    });

    rootMessenger.registerActionHandler(
      'AccountsController:listMultichainAccounts',
      () => MOCK_SOLANA_ACCOUNTS,
    );

    rootMessenger.registerActionHandler(
      'KeyringController:submitNonEvmRequest',
      async () => ({
        signature: '0x',
      }),
    );

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => MOCK_SOLANA_SNAP_PERMISSIONS,
    );

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async ({ handler }) => {
        if (handler === HandlerType.OnKeyringRequest) {
          return { address: SOLANA_CONNECTED_ACCOUNTS[0] };
        }
        throw new Error('Unmocked request');
      },
    );

    const result = await messenger.call(
      'MultichainRoutingController:handleRequest',
      {
        connectedAddresses: SOLANA_CONNECTED_ACCOUNTS,
        scope: SOLANA_CAIP2,
        request: {
          method: 'signAndSendTransaction',
          params: {
            message: 'foo',
          },
        },
      },
    );

    expect(result).toStrictEqual({ signature: '0x' });
  });

  it('can route protocol requests to procotol Snaps', async () => {
    const rootMessenger = getRootMultichainRoutingControllerMessenger();
    const messenger =
      getRestrictedMultichainRoutingControllerMessenger(rootMessenger);

    /* eslint-disable-next-line no-new */
    new MultichainRoutingController({
      messenger,
    });

    rootMessenger.registerActionHandler(
      'AccountsController:listMultichainAccounts',
      () => [],
    );

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [getTruncatedSnap()];
    });

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => MOCK_SOLANA_SNAP_PERMISSIONS,
    );

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      async () => ({
        'feature-set': 2891131721,
        'solana-core': '1.16.7',
      }),
    );

    const result = await messenger.call(
      'MultichainRoutingController:handleRequest',
      {
        connectedAddresses: [],
        scope: SOLANA_CAIP2,
        request: {
          method: 'getVersion',
        },
      },
    );

    expect(result).toStrictEqual({
      'feature-set': 2891131721,
      'solana-core': '1.16.7',
    });
  });

  it('throws if no suitable Snaps are found', async () => {
    const rootMessenger = getRootMultichainRoutingControllerMessenger();
    const messenger =
      getRestrictedMultichainRoutingControllerMessenger(rootMessenger);

    /* eslint-disable-next-line no-new */
    new MultichainRoutingController({
      messenger,
    });

    rootMessenger.registerActionHandler(
      'AccountsController:listMultichainAccounts',
      () => [],
    );

    rootMessenger.registerActionHandler('SnapController:getAll', () => {
      return [];
    });

    await expect(
      messenger.call('MultichainRoutingController:handleRequest', {
        connectedAddresses: [],
        scope: SOLANA_CAIP2,
        request: {
          method: 'getVersion',
        },
      }),
    ).rejects.toThrow('The method does not exist / is not available');
  });
});
