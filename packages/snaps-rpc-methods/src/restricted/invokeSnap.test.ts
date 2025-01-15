import type { PermissionsRequest } from '@metamask/permission-controller';
import { PermissionType } from '@metamask/permission-controller';
import { SnapCaveatType } from '@metamask/snaps-utils';
import {
  MOCK_SNAP_ID,
  MOCK_ORIGIN,
  getTruncatedSnap,
  MockControllerMessenger,
  MOCK_LOCAL_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';

import type { InstallSnaps, GetPermittedSnaps } from './invokeSnap';
import {
  invokeSnapBuilder,
  getInvokeSnapImplementation,
  WALLET_SNAP_PERMISSION_KEY,
  handleSnapInstall,
} from './invokeSnap';

describe('builder', () => {
  it('has the expected shape', () => {
    expect(invokeSnapBuilder).toMatchObject({
      targetName: WALLET_SNAP_PERMISSION_KEY,
      specificationBuilder: expect.any(Function),
      methodHooks: {
        getSnap: true,
        handleSnapRpcRequest: true,
      },
    });
  });

  it('builder outputs expected specification', () => {
    expect(
      invokeSnapBuilder.specificationBuilder({
        methodHooks: {
          getSnap: jest.fn(),
          handleSnapRpcRequest: jest.fn(),
        },
      }),
    ).toStrictEqual({
      permissionType: PermissionType.RestrictedMethod,
      targetName: WALLET_SNAP_PERMISSION_KEY,
      allowedCaveats: [SnapCaveatType.SnapIds],
      methodImplementation: expect.any(Function),
      sideEffect: {
        onPermitted: expect.any(Function),
      },
      validator: expect.any(Function),
    });
  });
});

describe('specificationBuilder', () => {
  const specification = invokeSnapBuilder.specificationBuilder({
    methodHooks: {
      getSnap: jest.fn(),
      handleSnapRpcRequest: jest.fn(),
    },
  });
  describe('validator', () => {
    it('throws if the caveat is not a single "snapIds"', () => {
      expect(() =>
        // @ts-expect-error Missing required permission types.
        specification.validator({}),
      ).toThrow('Expected a single "snapIds" caveat.');

      expect(() =>
        // @ts-expect-error Missing required permission types.
        specification.validator({ caveats: [{ type: 'foo', value: 'bar' }] }),
      ).toThrow('Expected a single "snapIds" caveat.');

      expect(() =>
        // @ts-expect-error Missing required permission types.
        specification.validator({
          caveats: [
            { type: SnapCaveatType.SnapIds, value: { [MOCK_SNAP_ID]: {} } },
            { type: SnapCaveatType.SnapIds, value: { [MOCK_SNAP_ID]: {} } },
          ],
        }),
      ).toThrow('Expected a single "snapIds" caveat.');
    });
  });
});

describe('implementation', () => {
  const getMockHooks = () =>
    ({
      getSnap: jest.fn(),
      handleSnapRpcRequest: jest.fn(),
    }) as any;
  it('calls handleSnapRpcRequest', async () => {
    const hooks = getMockHooks();
    hooks.getSnap.mockImplementation(getTruncatedSnap);
    const implementation = getInvokeSnapImplementation(hooks);
    await implementation({
      context: { origin: MOCK_ORIGIN },
      method: WALLET_SNAP_PERMISSION_KEY,
      params: {
        snapId: MOCK_SNAP_ID,
        request: { method: 'hello', params: {} },
      },
    });

    expect(hooks.getSnap).toHaveBeenCalledTimes(1);
    expect(hooks.getSnap).toHaveBeenCalledWith(MOCK_SNAP_ID);
    expect(hooks.handleSnapRpcRequest).toHaveBeenCalledWith({
      handler: 'onRpcRequest',
      origin: MOCK_ORIGIN,
      request: {
        method: 'hello',
        params: {},
      },
      snapId: MOCK_SNAP_ID,
    });
  });

  it('throws if snap is not installed', async () => {
    const hooks = getMockHooks();
    const implementation = getInvokeSnapImplementation(hooks);
    await expect(
      implementation({
        context: { origin: MOCK_ORIGIN },
        method: WALLET_SNAP_PERMISSION_KEY,
        params: {
          snapId: MOCK_SNAP_ID,
          request: { method: 'hello', params: {} },
        },
      }),
    ).rejects.toThrow(
      `The snap "${MOCK_SNAP_ID}" is not installed. Please install it first, before invoking the snap.`,
    );
    expect(hooks.getSnap).toHaveBeenCalledTimes(1);
    expect(hooks.getSnap).toHaveBeenCalledWith(MOCK_SNAP_ID);

    expect(hooks.handleSnapRpcRequest).not.toHaveBeenCalled();
  });
});

describe('handleSnapInstall', () => {
  it('calls SnapController:install with the right parameters', async () => {
    const messenger = new MockControllerMessenger<
      InstallSnaps | GetPermittedSnaps,
      never
    >();

    const sideEffectMessenger = messenger.getRestricted({
      name: 'PermissionController',
      allowedActions: ['SnapController:install', 'SnapController:getPermitted'],
    });

    const expectedResult = {
      [MOCK_SNAP_ID]: getTruncatedSnap(),
    };

    messenger.registerActionHandler(
      'SnapController:install',
      async () => expectedResult,
    );

    messenger.registerActionHandler('SnapController:getPermitted', () => ({}));

    jest.spyOn(sideEffectMessenger, 'call');

    const requestedSnaps = {
      [MOCK_SNAP_ID]: {},
    };

    const requestData = {
      permissions: {
        [WALLET_SNAP_PERMISSION_KEY]: {
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: requestedSnaps,
            },
          ],
        },
      },
      metadata: { origin: MOCK_ORIGIN, id: 'foo' },
    } as PermissionsRequest;

    const result = await handleSnapInstall({
      requestData,
      messagingSystem: sideEffectMessenger,
    });

    expect(sideEffectMessenger.call).toHaveBeenCalledWith(
      'SnapController:install',
      MOCK_ORIGIN,
      requestedSnaps,
    );

    expect(result).toBe(expectedResult);
  });

  it('dedupes snaps before calling installSnaps', async () => {
    const messenger = new MockControllerMessenger<
      InstallSnaps | GetPermittedSnaps,
      never
    >();

    const sideEffectMessenger = messenger.getRestricted({
      name: 'PermissionController',
      allowedActions: ['SnapController:install', 'SnapController:getPermitted'],
    });

    const expectedResult = {
      [MOCK_LOCAL_SNAP_ID]: getTruncatedSnap({ id: MOCK_LOCAL_SNAP_ID }),
    };

    messenger.registerActionHandler(
      'SnapController:install',
      async () => expectedResult,
    );

    messenger.registerActionHandler('SnapController:getPermitted', () => ({
      [MOCK_SNAP_ID]: getTruncatedSnap(),
    }));

    jest.spyOn(sideEffectMessenger, 'call');

    const requestedSnaps = {
      [MOCK_SNAP_ID]: {},
      [MOCK_LOCAL_SNAP_ID]: {},
    };

    const requestData = {
      permissions: {
        [WALLET_SNAP_PERMISSION_KEY]: {
          caveats: [
            {
              type: SnapCaveatType.SnapIds,
              value: requestedSnaps,
            },
          ],
        },
      },
      metadata: { origin: MOCK_ORIGIN, id: 'foo' },
    } as PermissionsRequest;

    const result = await handleSnapInstall({
      requestData,
      messagingSystem: sideEffectMessenger,
    });

    expect(sideEffectMessenger.call).toHaveBeenCalledWith(
      'SnapController:install',
      MOCK_ORIGIN,
      { [MOCK_LOCAL_SNAP_ID]: {} },
    );

    expect(result).toBe(expectedResult);
  });
});
