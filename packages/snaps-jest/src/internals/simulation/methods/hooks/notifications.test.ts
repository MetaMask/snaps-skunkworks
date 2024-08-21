import { NotificationType } from '@metamask/snaps-sdk';

import {
  getShowInAppNotificationImplementation,
  getShowNativeNotificationImplementation,
} from './notifications';
import { getMockOptions } from '../../../../test-utils';
import { createStore } from '../../store';

describe('getShowNativeNotificationImplementation', () => {
  it('returns the implementation of the `showNativeNotification` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getShowNativeNotificationImplementation(runSaga);

    expect(
      await fn('snap-id', {
        type: NotificationType.Native,
        message: 'message',
      }),
    ).toBeNull();

    expect(store.getState().notifications.notifications).toStrictEqual([
      {
        id: expect.any(String),
        type: NotificationType.Native,
        message: 'message',
      },
    ]);
  });
});

describe('getShowInAppNotificationImplementation', () => {
  it('returns the implementation of the `showInAppNotification` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getShowInAppNotificationImplementation(runSaga);

    expect(
      await fn('snap-id', {
        type: NotificationType.InApp,
        message: 'message',
      }),
    ).toBeNull();

    expect(store.getState().notifications.notifications).toStrictEqual([
      {
        id: expect.any(String),
        type: NotificationType.InApp,
        message: 'message',
      },
    ]);
  });
});
