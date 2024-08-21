import type {
  SnapInterfaceController,
  StoredInterface,
} from '@metamask/snaps-controllers';
import { AuxiliaryFileEncoding } from '@metamask/snaps-sdk';
import type {
  DialogType,
  NotifyParams,
  Json,
  SnapId,
  ComponentOrElement,
} from '@metamask/snaps-sdk';
import type { VirtualFile } from '@metamask/snaps-utils';
import {
  encodeAuxiliaryFile,
  normalizeRelative,
  parseJson,
} from '@metamask/snaps-utils';
import { nanoid } from '@reduxjs/toolkit';
import type { SagaIterator } from 'redux-saga';
import { call, put, select, take } from 'redux-saga/effects';

import {
  closeUserInterface,
  getAuxiliaryFiles,
  getRequestId,
  getSnapInterfaceController,
  getSnapName,
  getSnapStateSelector,
  getUnencryptedSnapStateSelector,
  resolveUserInterface,
  setSnapState,
  setUnencryptedSnapState,
  setSnapInterface,
  showUserInterface,
} from './slice';
import { addNativeNotification, addNotification } from '../notifications';

/**
 * Show a dialog to the user.
 *
 * @param snapId - The ID of the Snap that created the alert.
 * @param type - The type of dialog to show.
 * @param id - The snap interface ID.
 * @param _placeholder - The placeholder text to show in the dialog.
 * @yields Selects the current state.
 * @returns True if the dialog was shown, false otherwise.
 */
export function* showDialog(
  snapId: string,
  type: DialogType,
  id: string,
  _placeholder?: string,
): SagaIterator {
  const snapName = yield select(getSnapName);

  const snapInterface: StoredInterface = yield call(getInterface, snapId, id);
  // TODO: Support placeholder.
  yield put(
    showUserInterface({
      snapId,
      snapName: snapName ?? snapId,
      type,
      id,
    }),
  );

  yield put(setSnapInterface({ id, ...snapInterface }));

  const { payload } = yield take(resolveUserInterface.type);
  yield put(closeUserInterface());

  return payload;
}

/**
 * Show a native notification to the user.
 *
 * @param _snapId - The ID of the Snap that created the alert.
 * @param args - The arguments to pass to the notification.
 * @param args.message - The message to show in the notification.
 * @yields Calls the Notification API.
 * @returns `null`.
 */
export function* showNativeNotification(
  _snapId: string,
  { message }: NotifyParams,
): SagaIterator {
  const id = yield select(getRequestId);
  yield put(
    addNativeNotification({
      id,
      message,
    }),
  );

  const snapName = yield select(getSnapName);

  if (Notification.permission === 'default') {
    const permission = yield call([Notification, 'requestPermission']);
    if (permission === 'denied') {
      // Show notification permission denied error.
      yield put(
        addNotification({
          id: nanoid(),
          message:
            'Unable to show browser notification. Make sure notifications are enabled in your browser settings.',
        }),
      );
    }
  }

  if (Notification.permission === 'denied') {
    // Show notification permission denied error.
    yield put(
      addNotification({
        id: nanoid(),
        message:
          'Unable to show browser notification. Make sure notifications are enabled in your browser settings.',
      }),
    );
  }

  // eslint-disable-next-line no-new
  new Notification(snapName, {
    body: message,
  });

  return null;
}

/**
 * Show an in-app notification to the user.
 *
 * @param _snapId - The ID of the Snap that created the alert.
 * @param args - The arguments to pass to the notification.
 * @param args.message - The message to show in the notification.
 * @yields Adds a notification to the notification list.
 * @returns `null`.
 */
export function* showInAppNotification(
  _snapId: string,
  { message }: NotifyParams,
): SagaIterator {
  const id = yield select(getRequestId);
  yield put(
    addNotification({
      id,
      message,
    }),
  );

  return null;
}

/**
 * Updates the snap state in the simulation slice.
 *
 * @param _snapId - The snap id, unused for now.
 * @param newSnapState - The new state.
 * @param encrypted - A flag to signal whether to use the encrypted storage or not.
 * @yields Puts the newSnapState
 */
export function* updateSnapState(
  _snapId: string,
  newSnapState: Record<string, Json> | null,
  encrypted: boolean,
): SagaIterator {
  const stringified = JSON.stringify(newSnapState);
  yield put(
    encrypted
      ? setSnapState(stringified)
      : setUnencryptedSnapState(stringified),
  );
}

/**
 * Gets the snap state from the simulation slice.
 *
 * @param _snapId - The snap id, unused for now.
 * @param encrypted - A flag to signal whether to use the encrypted storage or not.
 * @returns The snap state.
 * @yields Selects the snap state from the simulation slice.
 */
export function* getSnapState(
  _snapId: string,
  encrypted: boolean,
): SagaIterator {
  const state: string = yield select(
    encrypted ? getSnapStateSelector : getUnencryptedSnapStateSelector,
  );
  return parseJson(state);
}

/**
 * Gets a statically defined snap file.
 *
 * Usually these would be stored in the SnapController.
 *
 * @param path - The file path.
 * @param encoding - The requested file encoding.
 * @returns The file in hexadecimal if found, otherwise null.
 * @yields Selects the state from the simulation slice.
 */
export function* getSnapFile(
  path: string,
  encoding: AuxiliaryFileEncoding = AuxiliaryFileEncoding.Base64,
): SagaIterator {
  const files: VirtualFile[] = yield select(getAuxiliaryFiles);
  const normalizedPath = normalizeRelative(path);
  const base64 = files
    .find((file) => file.path === normalizedPath)
    ?.toString('base64');

  if (!base64) {
    return null;
  }

  return yield call(encodeAuxiliaryFile, base64, encoding);
}

/**
 * Creates a snap interface.
 *
 * @param snapId - The snap id.
 * @param content - The content of the interface.
 * @returns The snap interface ID.
 * @yields Creates the interface in the SnapInterfaceController.
 */
export function* createInterface(
  snapId: string,
  content: ComponentOrElement,
): SagaIterator {
  const snapInterfaceController: SnapInterfaceController = yield select(
    getSnapInterfaceController,
  );

  return yield call(
    [snapInterfaceController, 'createInterface'],
    snapId as SnapId,
    content,
  );
}

/**
 * Gets a snap interface.
 *
 * @param snapId - The snap id.
 * @param id - The interface id.
 * @returns The snap interface.
 * @yields Gets the interface from the SnapInterfaceController.
 */
export function* getInterface(snapId: string, id: string): SagaIterator {
  const snapInterfaceController: SnapInterfaceController = yield select(
    getSnapInterfaceController,
  );

  return yield call(
    [snapInterfaceController, 'getInterface'],
    snapId as SnapId,
    id,
  );
}

/**
 * Updates a snap interface.
 *
 * @param snapId - The snap id.
 * @param id - The interface id.
 * @param content - The new content of the interface.
 * @yields Updates the interface in the SnapInterfaceController.
 */
export function* updateInterface(
  snapId: string,
  id: string,
  content: ComponentOrElement,
): SagaIterator {
  const snapInterfaceController: SnapInterfaceController = yield select(
    getSnapInterfaceController,
  );

  yield call(
    [snapInterfaceController, 'updateInterface'],
    snapId as SnapId,
    id,
    content,
  );

  const snapInterface: StoredInterface = yield call(getInterface, snapId, id);

  yield put(setSnapInterface({ id, ...snapInterface }));
}

/**
 * Gets the state of a snap interface.
 *
 * @param snapId - The snap id.
 * @param id - The interface id.
 * @returns The state of the interface.
 * @yields Gets the interface from the SnapInterfaceController.
 */
export function* getInterfaceState(snapId: string, id: string): SagaIterator {
  const snapInterfaceController: SnapInterfaceController = yield select(
    getSnapInterfaceController,
  );

  const { state } = yield call(
    [snapInterfaceController, 'getInterface'],
    snapId as SnapId,
    id,
  );

  return state;
}
