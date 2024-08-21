import type { SnapId } from '@metamask/snaps-sdk';
import { AuxiliaryFileEncoding, DialogType } from '@metamask/snaps-sdk';
import { Box, Input, Text } from '@metamask/snaps-sdk/jsx';
import { VirtualFile, normalizeRelative } from '@metamask/snaps-utils';
import { base64ToBytes, stringToBytes } from '@metamask/utils';
import { File } from 'buffer';
import { expectSaga } from 'redux-saga-test-plan';

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
import {
  closeUserInterface,
  getAuxiliaryFiles,
  getSnapName,
  getSnapStateSelector,
  getUnencryptedSnapStateSelector,
  resolveUserInterface,
  setSnapInterface,
  setSnapState,
  setUnencryptedSnapState,
  showUserInterface,
  getSnapInterfaceController,
} from './slice';
import { getSnapInterfaceController as getTestSnapInterfaceController } from './test/controllers';
import { MOCK_MANIFEST_FILE } from './test/mockManifest';
import { addNotification } from '../notifications';

Object.defineProperty(globalThis, 'Notification', {
  value: class Notification {
    static permission = 'default';

    static requestPermission = jest.fn().mockResolvedValue('granted');
  },
});

jest.mock('@reduxjs/toolkit', () => ({
  ...jest.requireActual('@reduxjs/toolkit'),
  nanoid: () => 'foo',
}));

// Because jest-fetch-mock replaces native fetch, we mock it here
Object.defineProperty(globalThis, 'fetch', {
  value: async (dataUrl: string) => {
    const base64 = dataUrl.replace('data:application/octet-stream;base64,', '');
    const u8 = base64ToBytes(base64);
    return new File([u8], '');
  },
});

const snapId = 'local:http://localhost:8080';

describe('showDialog', () => {
  const snapInterfaceController = getTestSnapInterfaceController();

  it('shows a dialog', async () => {
    const interfaceId = await snapInterfaceController.createInterface(
      snapId as SnapId,
      Box({ children: null }),
    );

    const snapInterface = await snapInterfaceController.getInterface(
      snapId as SnapId,
      interfaceId,
    );

    await expectSaga(showDialog, snapId, DialogType.Alert, interfaceId)
      .withState({
        simulation: {
          manifest: MOCK_MANIFEST_FILE,
          snapInterfaceController,
        },
      })
      .select(getSnapName)
      .put(
        showUserInterface({
          snapId,
          snapName: '@metamask/example-snap',
          type: DialogType.Alert,
          id: interfaceId,
        }),
      )
      .put(setSnapInterface({ id: interfaceId, ...snapInterface }))
      .dispatch(resolveUserInterface('foo'))
      .put(closeUserInterface())
      .returns('foo')
      .silentRun();
  });
});

describe('showNativeNotification', () => {
  it('requests permissions', async () => {
    await expectSaga(showNativeNotification, snapId, {
      type: 'native',
      message: 'foo',
    })
      .withState({
        simulation: {
          manifest: MOCK_MANIFEST_FILE,
        },
      })
      .call([Notification, 'requestPermission'])
      .returns(null)
      .silentRun();
  });

  it('shows a notification if the user did not grant permissions', async () => {
    jest.spyOn(Notification, 'requestPermission').mockResolvedValue('denied');

    await expectSaga(showNativeNotification, snapId, {
      type: 'native',
      message: 'foo',
    })
      .withState({
        simulation: {
          manifest: MOCK_MANIFEST_FILE,
        },
      })
      .call([Notification, 'requestPermission'])
      .put(
        addNotification({
          id: 'foo',
          message:
            'Unable to show browser notification. Make sure notifications are enabled in your browser settings.',
        }),
      )
      .returns(null)
      .silentRun();
  });
});

describe('showInAppNotification', () => {
  it('shows a notification', async () => {
    await expectSaga(showInAppNotification, snapId, {
      type: 'inApp',
      message: 'foo',
    })
      .withState({
        simulation: {
          requestId: 'bar',
        },
      })
      .put(
        addNotification({
          id: 'bar',
          message: 'foo',
        }),
      )
      .returns(null)
      .silentRun();
  });
});

describe('updateSnapState', () => {
  it('puts the new snap state', async () => {
    await expectSaga(updateSnapState, snapId, { foo: 'bar' }, true)
      .withState({
        simulation: {
          snapState: null,
        },
      })
      .put(setSnapState(JSON.stringify({ foo: 'bar' })))
      .silentRun();
  });

  it('puts the new unencrypted snap state', async () => {
    await expectSaga(updateSnapState, snapId, { foo: 'bar' }, false)
      .withState({
        simulation: {
          unencryptedSnapState: null,
        },
      })
      .put(setUnencryptedSnapState(JSON.stringify({ foo: 'bar' })))
      .silentRun();
  });
});

describe('getSnapState', () => {
  it('returns the selected snap state', async () => {
    await expectSaga(getSnapState, snapId, true)
      .withState({
        simulation: {
          snapState: JSON.stringify({ foo: 'bar' }),
        },
      })
      .select(getSnapStateSelector)
      .returns({ foo: 'bar' })
      .silentRun();
  });

  it('returns the selected unencrypted snap state', async () => {
    await expectSaga(getSnapState, snapId, false)
      .withState({
        simulation: {
          unencryptedSnapState: JSON.stringify({ foo: 'bar' }),
        },
      })
      .select(getUnencryptedSnapStateSelector)
      .returns({ foo: 'bar' })
      .silentRun();
  });
});

describe('getSnapFile', () => {
  it('returns the requested file in base64 by default', async () => {
    const path = './src/foo.json';
    await expectSaga(getSnapFile, path)
      .withState({
        simulation: {
          auxiliaryFiles: [
            new VirtualFile({
              path: normalizeRelative(path),
              value: stringToBytes(JSON.stringify({ foo: 'bar' })),
            }),
          ],
        },
      })
      .select(getAuxiliaryFiles)
      .returns('eyJmb28iOiJiYXIifQ==')
      .silentRun();
  });

  it('returns the requested file in hex when requested', async () => {
    const path = './src/foo.json';
    await expectSaga(getSnapFile, path, AuxiliaryFileEncoding.Hex)
      .withState({
        simulation: {
          auxiliaryFiles: [
            new VirtualFile({
              path: normalizeRelative(path),
              value: stringToBytes(JSON.stringify({ foo: 'bar' })),
            }),
          ],
        },
      })
      .select(getAuxiliaryFiles)
      .returns('0x7b22666f6f223a22626172227d')
      .silentRun();
  });
});

describe('createInterface', () => {
  it('creates an interface', async () => {
    const snapInterfaceController = getTestSnapInterfaceController();

    const { returnValue } = await expectSaga(
      createInterface,
      snapId,
      Box({ children: null }),
    )
      .withState({
        simulation: { snapInterfaceController },
      })
      .select(getSnapInterfaceController)
      .call(
        [snapInterfaceController, 'createInterface'],
        snapId as SnapId,
        Box({ children: null }),
      )

      .silentRun();

    expect(returnValue).toBe(
      Object.keys(snapInterfaceController.state.interfaces)[0],
    );
  });
});

describe('getInterface', () => {
  const snapInterfaceController = getTestSnapInterfaceController();

  it('returns the requested interface', async () => {
    const interfaceId = await snapInterfaceController.createInterface(
      snapId as SnapId,
      Box({ children: null }),
    );

    const snapInterface = snapInterfaceController.getInterface(
      snapId as SnapId,
      interfaceId,
    );

    await expectSaga(getInterface, snapId, interfaceId)
      .withState({
        simulation: { snapInterfaceController },
      })
      .select(getSnapInterfaceController)
      .call(
        [snapInterfaceController, 'getInterface'],
        snapId as SnapId,
        interfaceId,
      )
      .returns(snapInterface)
      .silentRun();
  });
});

describe('updateInterface', () => {
  it('updates the interface', async () => {
    const snapInterfaceController = getTestSnapInterfaceController();
    const interfaceId = await snapInterfaceController.createInterface(
      snapId as SnapId,
      Box({ children: null }),
    );

    await expectSaga(
      updateInterface,
      snapId,
      interfaceId,
      Box({ children: Text({ children: 'foo' }) }),
    )
      .withState({
        simulation: { snapInterfaceController },
      })
      .select(getSnapInterfaceController)
      .call(
        [snapInterfaceController, 'updateInterface'],
        snapId as SnapId,
        interfaceId,
        Box({ children: Text({ children: 'foo' }) }),
      )
      .call(getInterface, snapId, interfaceId)
      .put(
        setSnapInterface({
          id: interfaceId,
          state: {},
          snapId: snapId as SnapId,
          content: Box({ children: Text({ children: 'foo' }) }),
          context: null,
        }),
      )
      .silentRun();
  });
});

describe('getInterfaceState', () => {
  it('returns the state of the interface', async () => {
    const snapInterfaceController = getTestSnapInterfaceController();
    const interfaceId = await snapInterfaceController.createInterface(
      snapId as SnapId,
      Box({ children: Input({ name: 'foo', value: 'bar' }) }),
    );

    const snapInterface = await snapInterfaceController.getInterface(
      snapId as SnapId,
      interfaceId,
    );

    await expectSaga(getInterfaceState, snapId, interfaceId)
      .withState({
        simulation: { snapInterfaceController },
      })
      .select(getSnapInterfaceController)
      .call(
        [snapInterfaceController, 'getInterface'],
        snapId as SnapId,
        interfaceId,
      )
      .returns(snapInterface.state)
      .silentRun();
  });
});
