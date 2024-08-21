import type { SnapId } from '@metamask/snaps-sdk';
import type { SemVerVersion } from '@metamask/utils';

import type { MakeSemVer } from './common';
import {
  DEFAULT_SNAP_BUNDLE,
  DEFAULT_SNAP_SHASUM,
  getSnapManifest,
} from './manifest';
import type { PersistedSnap, Snap, TruncatedSnap } from '../snaps';
import { SnapStatus } from '../snaps';

export const MOCK_SNAP_ID = 'npm:@metamask/example-snap' as SnapId;
export const MOCK_LOCAL_SNAP_ID = 'local:http://localhost:8080' as SnapId;
export const MOCK_ORIGIN = 'https://example.com';

type GetPersistedSnapObjectOptions = Partial<MakeSemVer<PersistedSnap>>;
type GetSnapObjectOptions = Partial<MakeSemVer<Snap>>;
type GetTruncatedSnapOptions = Partial<MakeSemVer<TruncatedSnap>>;

export const getPersistedSnapObject = ({
  blocked = false,
  enabled = true,
  id = MOCK_SNAP_ID,
  initialPermissions = getSnapManifest().initialPermissions,
  initialConnections = getSnapManifest().initialConnections,
  manifest = getSnapManifest(),
  sourceCode = DEFAULT_SNAP_BUNDLE,
  status = SnapStatus.Stopped,
  version = getSnapManifest().version,
  versionHistory = [
    { origin: MOCK_ORIGIN, version: '1.0.0', date: expect.any(Number) },
  ],
  auxiliaryFiles = [],
  localizationFiles = [],
  removable = undefined,
  preinstalled = undefined,
}: GetPersistedSnapObjectOptions = {}): PersistedSnap => {
  return {
    blocked,
    initialPermissions,
    ...(initialConnections ? { initialConnections } : {}),
    id,
    version: version as SemVerVersion,
    manifest,
    status,
    enabled,
    sourceCode,
    versionHistory,
    auxiliaryFiles,
    localizationFiles,
    removable,
    preinstalled,
  } as const;
};

export const getSnapObject = ({
  blocked = false,
  enabled = true,
  id = MOCK_SNAP_ID,
  initialPermissions = getSnapManifest().initialPermissions,
  sourceCode = DEFAULT_SNAP_BUNDLE,
  manifest = getSnapManifest(),
  status = SnapStatus.Stopped,
  version = getSnapManifest().version,
  versionHistory = [
    { origin: MOCK_ORIGIN, version: '1.0.0', date: expect.any(Number) },
  ],
  auxiliaryFiles = [],
  localizationFiles = [],
  removable = undefined,
  preinstalled = undefined,
}: GetSnapObjectOptions = {}): Snap => {
  return {
    blocked,
    initialPermissions,
    sourceCode,
    id,
    version: version as SemVerVersion,
    manifest,
    status,
    enabled,
    versionHistory,
    auxiliaryFiles,
    localizationFiles,
    removable,
    preinstalled,
  } as const;
};

export const getTruncatedSnap = ({
  initialPermissions = getSnapManifest().initialPermissions,
  id = MOCK_SNAP_ID,
  version = getSnapManifest().version,
  enabled = true,
  blocked = false,
}: GetTruncatedSnapOptions = {}): TruncatedSnap => {
  return {
    initialPermissions,
    id,
    version: version as SemVerVersion,
    enabled,
    blocked,
  } as const;
};

/**
 * Gets a whole suite of associated snap data, including the snap's id, origin,
 * package name, source code, shasum, manifest, and SnapController state object.
 *
 * @param options - Options bag.
 * @param options.id - The id of the snap.
 * @param options.origin - The origin associated with the snap's installation
 * request.
 * @param options.sourceCode - The snap's source code. Will be used to compute
 * the snap's shasum.
 * @param options.blocked - Whether the snap's state object should indicate that
 * the snap is blocked.
 * @param options.enabled - Whether the snap's state object should indicate that
 * the snap is enabled. Must not be `true` if the snap is blocked.
 * @returns The mock snap data.
 */
export const getMockSnapData = ({
  blocked = false,
  enabled = true,
  id,
  origin,
  sourceCode,
}: {
  id: SnapId;
  origin: string;
  sourceCode?: string;
  blocked?: boolean;
  enabled?: boolean;
}) => {
  if (blocked && enabled) {
    throw new Error('A snap may not be enabled if it is blocked.');
  }

  const packageName = `${id}-package`;
  const manifest = getSnapManifest();

  return {
    id,
    origin,
    packageName,
    shasum: DEFAULT_SNAP_SHASUM,
    sourceCode,
    manifest,
    stateObject: getPersistedSnapObject({
      blocked,
      enabled,
      id,
      manifest,
      sourceCode,
    }),
  };
};
