import {
  clearState,
  createInterface,
  getBip32Entropy,
  getBip32PublicKey,
  getBip44Entropy,
  getClientStatus,
  getEntropy,
  getFile,
  getLocale,
  getState,
  notify,
  setState,
  updateInterface,
} from './provider-wrapper';
import { AuxiliaryFileEncoding, NotificationType } from './types';
import { panel, text } from './ui';

Object.defineProperty(globalThis, 'snap', {
  value: { request: jest.fn() },
});

describe('getBip32Entropy', () => {
  it('calls the underlying RPC method', async () => {
    const node = {
      chainCode:
        '0x50ccfa58a885b48b5eed09486b3948e8454f34856fb81da5d7b8519d7997abd1',
      curve: 'secp256k1',
      depth: 2,
      index: 2147483649,
      masterFingerprint: 1404659567,
      parentFingerprint: 1829122711,
      privateKey:
        '0xc73cedb996e7294f032766853a8b7ba11ab4ce9755fc052f2f7b9000044c99af',
      publicKey:
        '0x048e129862c1de5ca86468add43b001d32fd34b8113de716ecd63fa355b7f1165f0e76f5dc6095100f9fdaa76ddf28aa3f21406ac5fda7c71ffbedb45634fe2ceb',
    };
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      node,
    );
    expect(
      await getBip32Entropy('secp256k1', ['m', "44'", "1'"]),
    ).toStrictEqual(node);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getBip32Entropy',
      params: {
        curve: 'secp256k1',
        path: ['m', "44'", "1'"],
      },
    });
  });
});

describe('getBip32PublicKey', () => {
  it('calls the underlying RPC method', async () => {
    const publicKey =
      '0x0467f3cac111f47782b6c2d8d0984d51e22c128d24ec3eaca044509a386771d17206c740c7337c399d8ade8f52a60029340f288e11de82fffd3b69c5b863f6a515';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      publicKey,
    );
    expect(
      await getBip32PublicKey('secp256k1', ['m', "44'", "1'"]),
    ).toStrictEqual(publicKey);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getBip32PublicKey',
      params: {
        curve: 'secp256k1',
        path: ['m', "44'", "1'"],
        compressed: false,
      },
    });
  });

  it('supports specifying the optional compressed flag', async () => {
    const publicKey =
      '0x022de17487a660993177ce2a85bb73b6cd9ad436184d57bdf5a93f5db430bea914';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      publicKey,
    );
    expect(
      await getBip32PublicKey('secp256k1', ['m', "44'", "1'"], true),
    ).toStrictEqual(publicKey);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getBip32PublicKey',
      params: {
        curve: 'secp256k1',
        path: ['m', "44'", "1'"],
        compressed: true,
      },
    });
  });
});

describe('getBip44Entropy', () => {
  it('calls the underlying RPC method', async () => {
    const node = {
      chainCode:
        '0x50ccfa58a885b48b5eed09486b3948e8454f34856fb81da5d7b8519d7997abd1',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      coin_type: 1,
      depth: 2,
      index: 2147483649,
      masterFingerprint: 1404659567,
      parentFingerprint: 1829122711,
      path: "m / bip32:44' / bip32:1'",
      privateKey:
        '0xc73cedb996e7294f032766853a8b7ba11ab4ce9755fc052f2f7b9000044c99af',
      publicKey:
        '0x048e129862c1de5ca86468add43b001d32fd34b8113de716ecd63fa355b7f1165f0e76f5dc6095100f9fdaa76ddf28aa3f21406ac5fda7c71ffbedb45634fe2ceb',
    };
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      node,
    );
    expect(await getBip44Entropy(1)).toStrictEqual(node);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getBip44Entropy',
      params: {
        coinType: 1,
      },
    });
  });
});

describe('getClientStatus', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue({
      locked: false,
    });
    expect(await getClientStatus()).toStrictEqual({ locked: false });
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getClientStatus',
    });
  });
});

describe('getEntropy', () => {
  it('calls the underlying RPC method', async () => {
    const entropy =
      '0x6d8e92de419401c7da3cedd5f60ce5635b26059c2a4a8003877fec83653a4921';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      entropy,
    );
    expect(await getEntropy()).toStrictEqual(entropy);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getEntropy',
      params: {
        salt: undefined,
        version: 1,
      },
    });
  });

  it('can specify an optional salt', async () => {
    const entropy =
      '0x6d8e92de419401c7da3cedd5f60ce5635b26059c2a4a8003877fec83653a4921';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      entropy,
    );
    expect(await getEntropy(1, 'foo')).toStrictEqual(entropy);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getEntropy',
      params: {
        salt: 'foo',
        version: 1,
      },
    });
  });
});

describe('getFile', () => {
  it('calls the underlying RPC method', async () => {
    const file = 'SGVsbG8gd29ybGQh';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      file,
    );
    expect(await getFile('./foo/bar')).toStrictEqual(file);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getFile',
      params: {
        path: './foo/bar',
        encoding: 'base64',
      },
    });
  });

  it('can specify an optional encoding', async () => {
    const file = '0x48656c6c6f20776f726c6421';
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      file,
    );
    expect(await getFile('./foo/bar', AuxiliaryFileEncoding.Hex)).toStrictEqual(
      file,
    );
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getFile',
      params: {
        path: './foo/bar',
        encoding: 'hex',
      },
    });
  });
});

describe('getLocale', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      'en',
    );
    expect(await getLocale()).toBe('en');
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_getLocale',
    });
  });
});

describe('setState', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(await setState({ foo: 'bar' })).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: true,
        newState: {
          foo: 'bar',
        },
        operation: 'update',
      },
    });
  });

  it('can specify optional encrypted flag', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(await setState({ foo: 'bar' }, false)).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: false,
        newState: {
          foo: 'bar',
        },
        operation: 'update',
      },
    });
  });
});

describe('getState', () => {
  it('calls the underlying RPC method', async () => {
    const state = { foo: 'bar' };
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      state,
    );
    expect(await getState()).toStrictEqual(state);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: true,
        operation: 'get',
      },
    });
  });

  it('can specify optional encrypted flag', async () => {
    const state = { foo: 'bar' };
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      state,
    );
    expect(await getState(false)).toStrictEqual(state);
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: false,
        operation: 'get',
      },
    });
  });
});

describe('clearState', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(await clearState()).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: true,
        operation: 'clear',
      },
    });
  });

  it('can specify optional encrypted flag', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(await clearState(false)).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_manageState',
      params: {
        encrypted: false,
        operation: 'clear',
      },
    });
  });
});

describe('notify', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(await notify(NotificationType.InApp, 'Hello world!')).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_notify',
      params: {
        message: 'Hello world!',
        type: 'inApp',
      },
    });
  });
});

describe('createInterface', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      'foo',
    );
    expect(
      await createInterface(panel([text('Hello world!')]), { foo: 'bar' }),
    ).toBe('foo');
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_createInterface',
      params: {
        ui: {
          children: [
            {
              type: 'text',
              value: 'Hello world!',
            },
          ],
          type: 'panel',
        },
        context: { foo: 'bar' },
      },
    });
  });
});

describe('updateInterface', () => {
  it('calls the underlying RPC method', async () => {
    (snap.request as jest.MockedFn<typeof snap.request>).mockResolvedValue(
      null,
    );
    expect(
      await updateInterface('foo', panel([text('Hello world!')])),
    ).toBeNull();
    expect(snap.request).toHaveBeenCalledWith({
      method: 'snap_updateInterface',
      params: {
        id: 'foo',
        ui: {
          children: [
            {
              type: 'text',
              value: 'Hello world!',
            },
          ],
          type: 'panel',
        },
      },
    });
  });
});
