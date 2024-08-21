import { SnapEndowments } from '@metamask/snaps-rpc-methods';
import type { TruncatedSnap } from '@metamask/snaps-utils';
import { HandlerType } from '@metamask/snaps-utils';
import { MOCK_ORIGIN, MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';
import type { SemVerVersion } from '@metamask/utils';
import { Duration, inMilliseconds } from '@metamask/utils';

import { CronjobController } from './CronjobController';
import {
  getRestrictedCronjobControllerMessenger,
  getRootCronjobControllerMessenger,
} from '../test-utils';
import { getCronjobPermission } from '../test-utils/cronjob';

const MOCK_VERSION = '1.0' as SemVerVersion;

describe('CronjobController', () => {
  const originalProcessNextTick = process.nextTick;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2022-01-01'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('registers a cronjob', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    cronjobController.register(MOCK_SNAP_ID);

    expect(rootMessenger.call).toHaveBeenCalledWith(
      'PermissionController:getPermissions',
      MOCK_SNAP_ID,
    );

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('unregisters a cronjob', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    cronjobController.register(MOCK_SNAP_ID);
    cronjobController.unregister(MOCK_SNAP_ID);

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).not.toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('executes cronjobs that were missed during daily check in', async () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return { [SnapEndowments.Cronjob]: getCronjobPermission() };
      },
    );

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    // Update state manually for test
    // @ts-expect-error Accessing private property
    cronjobController.update(() => {
      return {
        jobs: {
          [`${MOCK_SNAP_ID}-0`]: { lastRun: 0 },
        },
      };
    });

    await cronjobController.dailyCheckIn();

    jest.advanceTimersByTime(inMilliseconds(24, Duration.Hour));

    expect(rootMessenger.call).toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethod',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('executes cronjobs that were missed during daily check in but doesnt repeat every init', async () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return {
          [SnapEndowments.Cronjob]: getCronjobPermission({
            expression: '30 * * * *',
          }),
        };
      },
    );

    const handleRequest = jest.fn();

    rootMessenger.registerActionHandler(
      'SnapController:handleRequest',
      handleRequest,
    );

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
      state: {
        jobs: {
          [`${MOCK_SNAP_ID}-0`]: { lastRun: 0 },
        },
      },
    });

    await new Promise((resolve) => originalProcessNextTick(resolve));

    expect(rootMessenger.call).toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethod',
          params: ['p1'],
        },
      },
    );

    const cronjobController2 = new CronjobController({
      messenger: controllerMessenger,
      state: cronjobController.state,
    });

    await new Promise((resolve) => originalProcessNextTick(resolve));

    expect(handleRequest).toHaveBeenCalledTimes(1);

    cronjobController.destroy();
    cronjobController2.destroy();
  });

  it('does not schedule cronjob that is too far in the future', () => {
    const expression = '59 23 29 2 *'; // At 11:59pm on February 29th

    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    rootMessenger.registerActionHandler(
      'PermissionController:getPermissions',
      () => {
        return {
          [SnapEndowments.Cronjob]: getCronjobPermission({ expression }),
        };
      },
    );

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    cronjobController.register(MOCK_SNAP_ID);

    expect(rootMessenger.call).toHaveBeenCalledWith(
      'PermissionController:getPermissions',
      MOCK_SNAP_ID,
    );

    jest.runOnlyPendingTimers();

    expect(rootMessenger.call).not.toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethod',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('handles SnapInstalled event', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    const snapInfo: TruncatedSnap = {
      blocked: false,
      enabled: true,
      id: MOCK_SNAP_ID,
      initialPermissions: {},
      version: MOCK_VERSION,
    };

    rootMessenger.publish(
      'SnapController:snapInstalled',
      snapInfo,
      MOCK_ORIGIN,
    );

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('handles SnapEnabled event', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    const snapInfo: TruncatedSnap = {
      blocked: false,
      enabled: true,
      id: MOCK_SNAP_ID,
      initialPermissions: {},
      version: MOCK_VERSION,
    };

    rootMessenger.publish('SnapController:snapEnabled', snapInfo);

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      4,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('handles SnapUninstalled event', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    const snapInfo: TruncatedSnap = {
      blocked: false,
      enabled: true,
      id: MOCK_SNAP_ID,
      initialPermissions: {},
      version: MOCK_VERSION,
    };

    rootMessenger.publish(
      'SnapController:snapInstalled',
      snapInfo,
      MOCK_ORIGIN,
    );

    rootMessenger.publish('SnapController:snapUninstalled', snapInfo);

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).not.toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('handles SnapDisabled event', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    const snapInfo: TruncatedSnap = {
      blocked: false,
      enabled: true,
      id: MOCK_SNAP_ID,
      initialPermissions: {},
      version: MOCK_VERSION,
    };

    rootMessenger.publish(
      'SnapController:snapInstalled',
      snapInfo,
      MOCK_ORIGIN,
    );

    rootMessenger.publish('SnapController:snapDisabled', snapInfo);

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).not.toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('handles SnapUpdated event', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    const snapInfo: TruncatedSnap = {
      blocked: false,
      enabled: true,
      id: MOCK_SNAP_ID,
      initialPermissions: {},
      version: MOCK_VERSION,
    };

    rootMessenger.publish(
      'SnapController:snapInstalled',
      snapInfo,
      MOCK_ORIGIN,
    );

    rootMessenger.publish(
      'SnapController:snapUpdated',
      snapInfo,
      snapInfo.version,
      MOCK_ORIGIN,
    );

    jest.advanceTimersByTime(inMilliseconds(15, Duration.Minute));

    expect(rootMessenger.call).toHaveBeenNthCalledWith(
      5,
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );

    cronjobController.destroy();
  });

  it('removes all jobs and schedules after controller destroy is called', () => {
    const rootMessenger = getRootCronjobControllerMessenger();
    const controllerMessenger =
      getRestrictedCronjobControllerMessenger(rootMessenger);

    const cronjobController = new CronjobController({
      messenger: controllerMessenger,
    });

    cronjobController.register(MOCK_SNAP_ID);

    expect(rootMessenger.call).toHaveBeenCalledWith(
      'PermissionController:getPermissions',
      MOCK_SNAP_ID,
    );

    cronjobController.destroy();

    jest.advanceTimersByTime(inMilliseconds(1, Duration.Minute));

    expect(rootMessenger.call).not.toHaveBeenCalledWith(
      'SnapController:handleRequest',
      {
        snapId: MOCK_SNAP_ID,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: {
          method: 'exampleMethodOne',
          params: ['p1'],
        },
      },
    );
  });
});
