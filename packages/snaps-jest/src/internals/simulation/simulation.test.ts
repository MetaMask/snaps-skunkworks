import { mnemonicPhraseToBytes } from '@metamask/key-tree';
import {
  detectSnapLocation,
  fetchSnap,
  NodeThreadExecutionService,
  SnapInterfaceController,
} from '@metamask/snaps-controllers/node';
import { DIALOG_APPROVAL_TYPES } from '@metamask/snaps-rpc-methods';
import { AuxiliaryFileEncoding, text } from '@metamask/snaps-sdk';
import { VirtualFile } from '@metamask/snaps-utils';
import { getSnapManifest } from '@metamask/snaps-utils/test-utils';

import { DEFAULT_SRP } from './constants';
import { getHooks, handleInstallSnap, registerActions } from './simulation';
import { createStore, setInterface } from './store';
import {
  getMockOptions,
  getMockServer,
  getRestrictedSnapInterfaceControllerMessenger,
  getRootControllerMessenger,
} from '../../test-utils';

describe('handleInstallSnap', () => {
  it('installs a Snap and returns the execution service', async () => {
    const { snapId, close } = await getMockServer();
    const installedSnap = await handleInstallSnap(snapId);

    expect(installedSnap.executionService).toBeInstanceOf(
      NodeThreadExecutionService,
    );

    await close();
  });
});

describe('getHooks', () => {
  const controllerMessenger = getRootControllerMessenger();

  it('returns the `getMnemonic` hook', async () => {
    const { snapId, close } = await getMockServer();

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { getMnemonic } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );
    expect(await getMnemonic()).toStrictEqual(
      mnemonicPhraseToBytes(DEFAULT_SRP),
    );

    await close();
  });

  it('returns the `getSnapFile` hook', async () => {
    const value = JSON.stringify({ bar: 'baz' });
    const { snapId, close } = await getMockServer({
      manifest: getSnapManifest({
        files: ['foo.json'],
      }),
      auxiliaryFiles: [
        new VirtualFile({
          path: 'foo.json',
          value,
        }),
      ],
    });

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { getSnapFile } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );
    const file = await getSnapFile('foo.json', AuxiliaryFileEncoding.Utf8);
    expect(file).toStrictEqual(value);

    await close();
  });

  it('returns the `createInterface` hook', async () => {
    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const content = text('foo');
    const { snapId, close } = await getMockServer({
      manifest: getSnapManifest(),
    });

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { createInterface } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );
    await createInterface(content);

    expect(controllerMessenger.call).toHaveBeenCalledWith(
      'SnapInterfaceController:createInterface',
      snapId,
      content,
    );

    await close();
  });

  it('returns the `updateInterface` hook', async () => {
    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const content = text('bar');
    const { snapId, close } = await getMockServer({
      manifest: getSnapManifest(),
    });

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { createInterface, updateInterface } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );

    const id = await createInterface(text('foo'));

    await updateInterface(id, content);

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      3,
      'SnapInterfaceController:updateInterface',
      snapId,
      id,
      content,
    );

    await close();
  });

  it('returns the `getInterfaceState` hook', async () => {
    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const { snapId, close } = await getMockServer({
      manifest: getSnapManifest(),
    });

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { createInterface, getInterfaceState } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );

    const id = await createInterface(text('foo'));

    const result = getInterfaceState(id);

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      3,
      'SnapInterfaceController:getInterface',
      snapId,
      id,
    );

    expect(result).toStrictEqual({});
    await close();
  });

  it('returns the `resolveInterface` hook', async () => {
    // eslint-disable-next-line no-new
    const snapInterfaceController = new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const { snapId, close } = await getMockServer({
      manifest: getSnapManifest(),
    });
    const id = await snapInterfaceController.createInterface(
      snapId,
      text('foo'),
    );

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { resolveInterface } = getHooks(
      getMockOptions({
        state: {
          ui: {
            current: {
              id,
              type: DIALOG_APPROVAL_TYPES.default,
            },
          },
        },
      }),
      snapFiles,
      snapId,
      controllerMessenger,
    );

    await resolveInterface(id, 'foobar');

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      2,
      'SnapInterfaceController:resolveInterface',
      snapId,
      id,
      'foobar',
    );

    await close();
  });

  it('returns the `getIsLocked` hook', async () => {
    const { snapId, close } = await getMockServer();

    const location = detectSnapLocation(snapId, {
      allowLocal: true,
    });
    const snapFiles = await fetchSnap(snapId, location);

    const { getIsLocked } = getHooks(
      getMockOptions(),
      snapFiles,
      snapId,
      controllerMessenger,
    );
    expect(getIsLocked()).toBe(false);

    await close();
  });
});

describe('registerActions', () => {
  const { runSaga, store } = createStore(getMockOptions());
  const controllerMessenger = getRootControllerMessenger(false);

  it('registers `PhishingController:testOrigin`', async () => {
    registerActions(controllerMessenger, runSaga);

    expect(
      controllerMessenger.call('PhishingController:testOrigin', 'foo'),
    ).toStrictEqual({ result: false, type: 'all' });
  });

  it('registers `ApprovalController:hasRequest`', async () => {
    registerActions(controllerMessenger, runSaga);

    store.dispatch(
      setInterface({ type: DIALOG_APPROVAL_TYPES.default, id: 'foo' }),
    );

    expect(
      controllerMessenger.call('ApprovalController:hasRequest', { id: 'foo' }),
    ).toBe(true);
  });

  it('registers `ApprovalController:acceptRequest`', async () => {
    registerActions(controllerMessenger, runSaga);

    store.dispatch(
      setInterface({ type: DIALOG_APPROVAL_TYPES.default, id: 'foo' }),
    );

    expect(
      await controllerMessenger.call(
        'ApprovalController:acceptRequest',
        'foo',
        'bar',
      ),
    ).toStrictEqual({ value: 'bar' });
  });
});
