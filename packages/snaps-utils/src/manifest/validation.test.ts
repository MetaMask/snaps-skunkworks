import { assert, is, StructError } from '@metamask/superstruct';

import {
  assertIsSnapManifest,
  Bip32EntropyStruct,
  Bip32PathStruct,
  createSnapManifest,
  CurveStruct,
  EmptyObjectStruct,
  isSnapManifest,
  PermissionsStruct,
  SnapIdsStruct,
} from './validation';
import { getSnapManifest, MOCK_SNAP_ID } from '../test-utils';

describe('Bip32PathStruct', () => {
  it.each(['m/0/1/2', "m/0'/1/2", "m/1'/2'/3'/4/5/6", "m/0/1'/2"])(
    'validates correctly',
    (path) => {
      expect(is(path.split('/'), Bip32PathStruct)).toBe(true);
    },
  );

  it('requires an array', () => {
    expect(is(['m', "0'", '123'], Bip32PathStruct)).toBe(true);
    expect(is("m/0'/123", Bip32PathStruct)).toBe(false);
    expect(is(42, Bip32PathStruct)).toBe(false);
  });

  it('requires an non-empty array', () => {
    expect(() => assert([], Bip32PathStruct)).toThrow('non-empty');
  });

  it('requires "m" as first argument', () => {
    expect(() => assert(['a'], Bip32PathStruct)).toThrow(
      'Path must start with "m"',
    );

    expect(() => assert(['a', "0'", '123'], Bip32PathStruct)).toThrow(
      'Path must start with "m"',
    );
  });

  it('requires length >= 3', () => {
    expect(() => assert(['m', "0'", '123'], Bip32PathStruct)).not.toThrow();
    expect(() =>
      assert(['m', "0'", '123', '456'], Bip32PathStruct),
    ).not.toThrow();

    expect(() => assert(['m', "0'"], Bip32PathStruct)).toThrow(
      'length of at least three',
    );

    expect(() => assert(['m'], Bip32PathStruct)).toThrow(
      'length of at least three',
    );
  });

  it.each([
    "m/0'/123/asd",
    'm/0"/123',
    'm/1/2/3/_',
    "m/1'/2'/3'/-1",
    "m/1'/2147483648'",
  ])('requires numbers or hardened numbers per BIP32', (path) => {
    expect(() => assert(path.split('/'), Bip32PathStruct)).toThrow(
      'Path must be a valid BIP-32 derivation path array.',
    );
  });

  it('throws for forbidden purposes', () => {
    expect(() => assert(['m', "1399742832'", '0'], Bip32PathStruct)).toThrow(
      'The purpose "1399742832\'" is not allowed for entropy derivation.',
    );
  });

  it.each([`m/44'/60'/0'/0/0`, `m/44'/60'/0'/0`, `m/44'/60'/0'`, `m/44'/60'`])(
    'throws for forbidden paths',
    (path) => {
      expect(() => assert(path.split('/'), Bip32PathStruct)).toThrow(
        `The path "${path}" is not allowed for entropy derivation.`,
      );
    },
  );
});

describe('CurveStruct', () => {
  it.each(['secp256k1', 'ed25519', 'ed25519Bip32'])('validates %p', (curve) => {
    expect(is(curve, CurveStruct)).toBe(true);
  });

  it.each([1, '', 'asd', {}, null, undefined])(
    'does not validate %p',
    (curve) => {
      expect(is(curve, CurveStruct)).toBe(false);
    },
  );
});

describe('Bip32EntropyStruct', () => {
  it('works with ed25519', () => {
    expect(
      is(
        { path: "m/0'/1'/2'".split('/'), curve: 'ed25519' },
        Bip32EntropyStruct,
      ),
    ).toBe(true);
  });

  it('ed25519 requires hardened paths', () => {
    expect(() =>
      assert(
        { path: "m/0'/1'/2'/3".split('/'), curve: 'ed25519' },
        Bip32EntropyStruct,
      ),
    ).toThrow('Ed25519 does not support unhardened paths.');
  });

  it('works with secp256k1', () => {
    expect(
      is(
        { path: 'm/0/1/2'.split('/'), curve: 'secp256k1' },
        Bip32EntropyStruct,
      ),
    ).toBe(true);
  });

  it.each([1, '', 'asd', {}, null, undefined])(
    'requires valid curve',
    (curve) => {
      expect(
        is({ path: "m/0'/1'/2'".split('/'), curve }, Bip32EntropyStruct),
      ).toBe(false);
    },
  );

  it.each([42, "m/0'/123/asd".split('/')])('requires valid path', (path) => {
    expect(is({ path, curve: 'secp256k1' }, Bip32EntropyStruct)).toBe(false);
  });

  it.each([undefined, null, {}, { asd: 123 }])(
    'requires valid structure',
    (value) => {
      expect(is(value, Bip32EntropyStruct)).toBe(false);
    },
  );
});

describe('SnapIdsStruct', () => {
  it('requires at least one snap ID', () => {
    expect(is({}, SnapIdsStruct)).toBe(false);
  });

  it('requires valid snap IDs', () => {
    expect(is({ [MOCK_SNAP_ID]: {} }, SnapIdsStruct)).toBe(true);
    expect(is({ fooBar: {} }, SnapIdsStruct)).toBe(false);
  });

  it('requires a valid snap ID object', () => {
    expect(is({ [MOCK_SNAP_ID]: {} }, SnapIdsStruct)).toBe(true);
    expect(is({ [MOCK_SNAP_ID]: { version: '2.0.0' } }, SnapIdsStruct)).toBe(
      true,
    );
    expect(is({ [MOCK_SNAP_ID]: { version: '3.0.0.0' } }, SnapIdsStruct)).toBe(
      false,
    );
    expect(is({ fooBar: {} }, SnapIdsStruct)).toBe(false);
  });
});

describe('EmptyObjectStruct', () => {
  it('accepts an empty object', () => {
    expect(is({}, EmptyObjectStruct)).toBe(true);
  });

  it('rejects non-empty objects', () => {
    expect(is({ foo: 'bar' }, EmptyObjectStruct)).toBe(false);
  });
});

describe('isSnapManifest', () => {
  it('returns true for a valid snap manifest', () => {
    expect(isSnapManifest(getSnapManifest())).toBe(true);
  });

  it('accepts $schema property', () => {
    const manifest = {
      ...getSnapManifest(),
      $schema:
        'https://raw.githubusercontent.com/MetaMask/SIPs/main/assets/sip-9/snap.manifest.schema.json',
    };
    expect(isSnapManifest(manifest)).toBe(true);
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('returns false for an invalid snap manifest', (value) => {
    expect(isSnapManifest(value)).toBe(false);
  });
});

describe('assertIsSnapManifest', () => {
  it('does not throw for a valid snap manifest', () => {
    expect(() => assertIsSnapManifest(getSnapManifest())).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('throws for an invalid snap manifest', (value) => {
    expect(() => assertIsSnapManifest(value)).toThrow(
      '"snap.manifest.json" is invalid:',
    );
  });
});

describe('createSnapManifest', () => {
  it('does not throw for a valid snap manifest', () => {
    expect(() => createSnapManifest(getSnapManifest())).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { name: 'foo' },
    { version: '1.0.0' },
    getSnapManifest({ version: 'foo bar' }),
  ])('throws for an invalid snap manifest', (value) => {
    expect(() => createSnapManifest(value)).toThrow(StructError);
  });
});

describe('PermissionsStruct', () => {
  it('disallows empty endowment:rpc', () => {
    expect(is({ 'endowment:rpc': {} }, PermissionsStruct)).toBe(false);
  });
});
