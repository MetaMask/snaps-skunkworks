import type { SnapsRegistryDatabase } from '@metamask/snaps-registry';
import {
  DEFAULT_SNAP_SHASUM,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';
import type { SemVerRange, SemVerVersion } from '@metamask/utils';
import fetchMock from 'jest-fetch-mock';

import type { JsonSnapsRegistryArgs } from './json';
import { JsonSnapsRegistry } from './json';
import { SnapsRegistryStatus } from './registry';
import { getRestrictedSnapsRegistryControllerMessenger } from '../../test-utils';

// Public key for the private key:
// `0x541c6759fd86c69eceb8d792d7174623db139d81a5b560aa026afcb2dd1bb21c`.
const MOCK_PUBLIC_KEY =
  '0x03a885324b8520fba54a173999629952cfa1f97930c20902ec389f9c32c6ffbc40';

const getRegistry = (args?: Partial<JsonSnapsRegistryArgs>) => {
  const messenger = getRestrictedSnapsRegistryControllerMessenger();
  return {
    registry: new JsonSnapsRegistry({
      messenger,
      publicKey: MOCK_PUBLIC_KEY,
      ...args,
    }),
    messenger,
  };
};

const MOCK_DATABASE: SnapsRegistryDatabase = {
  verifiedSnaps: {
    [MOCK_SNAP_ID]: {
      id: MOCK_SNAP_ID,
      metadata: {
        name: 'Mock Snap',
      },
      versions: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ['1.0.0' as SemVerVersion]: {
          checksum: DEFAULT_SNAP_SHASUM,
        },
      },
    },
  },
  blockedSnaps: [
    {
      checksum: 'foo',
      reason: { explanation: 'malicious' },
    },
    {
      id: 'npm:@consensys/starknet-snap',
      versionRange: '<0.1.11' as SemVerRange,
      reason: { explanation: 'vuln' },
    },
  ],
};

// To regenerate this signature:
// 1. Use the private key above, and paste it in `secp256k1-key` in
//    `snaps-registry`.
// 2. JSON.stringify the database above, and paste it in the `sign-registry`
//    script in `snaps-registry` (instead of `fs.readFile`).
//    - Pasting the JSON in the registry file directly will not work, as it
//      contains a trailing newline.
// 3. Run the `sign-registry` script.
// 4. Copy the signature from the `signature.json` file.
const MOCK_SIGNATURE =
  '0x304402201bfe1a98837631b669643135766de58deb426dc3eeb0a908c8000f85a047db3102207ac621072ea59737287099ac830323b34e59bfc41fb62119b16ce24d0c433f9e';
const MOCK_SIGNATURE_FILE = {
  signature: MOCK_SIGNATURE,
  curve: 'secp256k1',
  format: 'DER',
};

// To regenerate this signature:
// 1. Follow the steps above, but use the empty database below:
//    `{"verifiedSnaps":{},"blockedSnaps":[]}`
const MOCK_EMPTY_SIGNATURE =
  '0x30450221009394dd1ab94c99079ce0e9f24170e4e4c40811e261013d3e6b80e4076cca7f9c0220201b6f5479a553fd50fc43fc50d18874583f29757b3f44cd088fae5aeb3595e2';
const MOCK_EMPTY_SIGNATURE_FILE = {
  signature: MOCK_EMPTY_SIGNATURE,
  curve: 'secp256k1',
  format: 'DER',
};

describe('JsonSnapsRegistry', () => {
  fetchMock.enableMocks();

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('can get entries from the registry', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Verified,
      },
    });
  });

  it('returns unverified for non existing snaps', async () => {
    // Empty database
    fetchMock
      .mockResponseOnce(JSON.stringify({ verifiedSnaps: {}, blockedSnaps: [] }))
      .mockResponseOnce(JSON.stringify(MOCK_EMPTY_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unverified,
      },
    });
  });

  it('returns unverified for non existing versions', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.1' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unverified,
      },
    });
  });

  it('returns unverified if existing snap doesnt match checksum', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: 'bar',
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unverified,
      },
    });
  });

  it('returns blocked if snap checksum is on blocklist', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: 'foo',
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Blocked,
        reason: { explanation: 'malicious' },
      },
    });
  });

  it('returns blocked if snap version range is on blocklist', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry();
    const result = await messenger.call('SnapsRegistry:get', {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'npm:@consensys/starknet-snap': {
        version: '0.1.10' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'npm:@consensys/starknet-snap': {
        status: SnapsRegistryStatus.Blocked,
        reason: { explanation: 'vuln' },
      },
    });
  });

  it('refetches the database on allowlist miss if configured', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry({
      refetchOnAllowlistMiss: true,
      state: {
        lastUpdated: 0,
        database: { verifiedSnaps: {}, blockedSnaps: [] },
      },
    });
    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Verified,
      },
    });
  });

  it('uses existing state if registry is unavailable', async () => {
    fetchMock.mockResponse('', { status: 404 });

    const { messenger } = getRegistry({
      refetchOnAllowlistMiss: true,
      state: {
        lastUpdated: 0,
        database: MOCK_DATABASE,
      },
    });

    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Verified,
      },
    });
  });

  it(`doesn't use existing state if existing state isn't sufficient`, async () => {
    fetchMock.mockResponse('', { status: 404 });

    const { messenger } = getRegistry({
      refetchOnAllowlistMiss: true,
      state: {
        lastUpdated: 0,
        database: MOCK_DATABASE,
      },
    });

    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.1' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unavailable,
      },
    });
  });

  it('returns unavailable if the database is unavailable', async () => {
    fetchMock.mockResponse('', { status: 404 });

    const { messenger } = getRegistry();

    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unavailable,
      },
    });
  });

  it('returns unavailable if signature is unavailable', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce('', {
        status: 404,
      });

    const { messenger } = getRegistry();

    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unavailable,
      },
    });
  });

  it('returns unavailable if signature is invalid', async () => {
    fetchMock
      .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
      .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

    const { messenger } = getRegistry({
      publicKey:
        '0x034ca27b046507d1a9997bddc991b56d96b93d4adac3a96dfe01ce450bfb661455',
    });

    const result = await messenger.call('SnapsRegistry:get', {
      [MOCK_SNAP_ID]: {
        version: '1.0.0' as SemVerVersion,
        checksum: DEFAULT_SNAP_SHASUM,
      },
    });

    expect(result).toStrictEqual({
      [MOCK_SNAP_ID]: {
        status: SnapsRegistryStatus.Unavailable,
      },
    });
  });

  describe('resolveVersion', () => {
    it('resolves to an allowlisted version', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      const result = await messenger.call(
        'SnapsRegistry:resolveVersion',
        MOCK_SNAP_ID,
        '^1.0.0' as SemVerRange,
      );

      expect(result).toBe('1.0.0');
    });

    it('returns version range if snap is not on the allowlist', async () => {
      fetchMock
        .mockResponseOnce(
          JSON.stringify({ verifiedSnaps: {}, blockedSnaps: [] }),
        )
        .mockResponseOnce(JSON.stringify(MOCK_EMPTY_SIGNATURE_FILE));

      const range = '^1.0.0' as SemVerRange;
      const { messenger } = getRegistry();
      expect(
        await messenger.call(
          'SnapsRegistry:resolveVersion',
          MOCK_SNAP_ID,
          range,
        ),
      ).toBe(range);
    });

    it('returns version range if resolved version is not on the allowlist', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const range = '^1.2.0' as SemVerRange;
      const { messenger } = getRegistry();
      expect(
        await messenger.call(
          'SnapsRegistry:resolveVersion',
          MOCK_SNAP_ID,
          range,
        ),
      ).toBe(range);
    });

    it('refetches the database on allowlist miss if configured', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry({
        refetchOnAllowlistMiss: true,
        state: {
          lastUpdated: 0,
          database: { verifiedSnaps: {}, blockedSnaps: [] },
        },
      });
      const result = await messenger.call(
        'SnapsRegistry:resolveVersion',
        MOCK_SNAP_ID,
        '^1.0.0' as SemVerRange,
      );

      expect(result).toBe('1.0.0');
    });

    it('refetches the database on allowlist version miss if configured', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry({
        refetchOnAllowlistMiss: true,
        state: {
          lastUpdated: 0,
          database: {
            verifiedSnaps: {
              [MOCK_SNAP_ID]: {
                id: MOCK_SNAP_ID,
                metadata: {
                  name: 'Mock Snap',
                },
                versions: {
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  ['0.0.1' as SemVerVersion]: {
                    checksum: DEFAULT_SNAP_SHASUM,
                  },
                },
              },
            },
            blockedSnaps: [],
          },
        },
      });
      const result = await messenger.call(
        'SnapsRegistry:resolveVersion',
        MOCK_SNAP_ID,
        '^1.0.0' as SemVerRange,
      );

      expect(result).toBe('1.0.0');
    });
  });

  describe('getMetadata', () => {
    it('returns the metadata for a verified snap', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      const result = await messenger.call(
        'SnapsRegistry:getMetadata',
        MOCK_SNAP_ID,
      );

      expect(result).toStrictEqual({
        name: 'Mock Snap',
      });
    });

    it('returns null for a non-verified snap', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      const result = await messenger.call('SnapsRegistry:getMetadata', 'foo');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('updates the database', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      await messenger.call('SnapsRegistry:update');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not fetch if a second call is made under the threshold', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      await messenger.call('SnapsRegistry:update');
      await messenger.call('SnapsRegistry:update');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not fetch twice with parallel promises', async () => {
      fetchMock
        .mockResponseOnce(JSON.stringify(MOCK_DATABASE))
        .mockResponseOnce(JSON.stringify(MOCK_SIGNATURE_FILE));

      const { messenger } = getRegistry();
      await Promise.all([
        messenger.call('SnapsRegistry:update'),
        messenger.call('SnapsRegistry:update'),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
