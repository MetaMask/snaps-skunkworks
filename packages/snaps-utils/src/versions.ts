import { assertStruct, Json } from '@metamask/utils';
import {
  gt as gtSemver,
  maxSatisfying as maxSatisfyingSemver,
  satisfies as satisfiesSemver,
  valid as validSemVerVersion,
  validRange as validSemVerRange,
} from 'semver';
import { is, refine, string, Struct } from 'superstruct';

export const DEFAULT_REQUESTED_SNAP_VERSION = '*' as SemVerRange;

/**
 * {@link https://codemix.com/opaque-types-in-javascript/ Opaque} type for SemVer ranges.
 * Castable from string.
 */
declare type SemVerRange = {
  __TYPE: 'semver_range';
} & string;
/**
 * {@link https://codemix.com/opaque-types-in-javascript/ Opaque} type for singular SemVer version.
 * Castable from string.
 */
declare type SemVerVersion = {
  __TYPE: 'semver_version';
} & string;
export { SemVerRange, SemVerVersion };

/**
 * A struct for validating a version string.
 */
export const VersionStruct = refine<SemVerVersion, null>(
  string() as unknown as Struct<SemVerVersion, null>,
  'Version',
  (value) => {
    if (validSemVerVersion(value) === null) {
      return `Expected SemVer version, got "${value}"`;
    }
    return true;
  },
);

export const VersionRangeStruct = refine<SemVerRange, null>(
  string() as unknown as Struct<SemVerRange, null>,
  'Version range',
  (value) => {
    if (validSemVerRange(value) === null) {
      return `Expected SemVer range, got "${value}"`;
    }
    return true;
  },
);

/**
 * Checks whether a SemVer version is valid.
 *
 * @param version - A potential version.
 * @returns `true` if the version is valid, and `false` otherwise.
 */
export function isValidSemVerVersion(
  version: unknown,
): version is SemVerVersion {
  return Boolean(
    typeof version === 'string' &&
      validSemVerVersion(version, { includePrerelease: true }) !== null,
  );
}

/**
 * Checks whether a SemVer version range is valid.
 *
 * @param versionRange - A potential version range.
 * @returns `true` if the version range is valid, and `false` otherwise.
 */
export function isValidSemVerRange(
  versionRange: unknown,
): versionRange is SemVerRange {
  return is(versionRange, VersionStruct);
}

/**
 * Asserts that a value is a valid concrete SemVer version.
 *
 * @param version - A potential SemVer concrete version.
 */
export function assertIsSemVerVersion(
  version: unknown,
): asserts version is SemVerVersion {
  assertStruct(version, VersionStruct);
}

/**
 * Asserts that a value is a valid SemVer range.
 *
 * @param range - A potential SemVer range.
 */
export function assertIsSemVerRange(
  range: unknown,
): asserts range is SemVerRange {
  assertStruct(range, VersionRangeStruct);
}

/**
 * Checks whether a SemVer version is greater than another.
 *
 * @param version1 - The left-hand version.
 * @param version2 - The right-hand version.
 * @returns `version1 > version2`.
 */
export function gtVersion(
  version1: SemVerVersion,
  version2: SemVerVersion,
): boolean {
  return gtSemver(version1, version2);
}

/**
 * Returns whether a SemVer version satisfies a SemVer range.
 *
 * @param version - The SemVer version to check.
 * @param versionRange - The SemVer version range to check against.
 * @returns Whether the version satisfied the version range.
 */
export function satisfiesVersionRange(
  version: SemVerVersion,
  versionRange: SemVerRange,
): boolean {
  return satisfiesSemver(version, versionRange, {
    includePrerelease: true,
  });
}

/**
 * Return the highest version in the list that satisfies the range, or `null` if
 * none of them do. For the satisfaction check, pre-release versions will only
 * be checked if no satisfactory non-prerelease version is found first.
 *
 * @param versions - The list of version to check.
 * @param versionRange - The SemVer version range to check against.
 * @returns The highest version in the list that satisfies the range,
 * or `null` if none of them do.
 */
export function getTargetVersion(
  versions: SemVerVersion[],
  versionRange: SemVerRange,
): SemVerVersion | null {
  const maxSatisfyingNonPreRelease = maxSatisfyingSemver(
    versions,
    versionRange,
  );

  // By default don't use pre-release versions
  if (maxSatisfyingNonPreRelease) {
    return maxSatisfyingNonPreRelease;
  }

  // If no satisfying release version is found by default, try pre-release versions
  return maxSatisfyingSemver(versions, versionRange, {
    includePrerelease: true,
  });
}

/**
 * Parse a version received by some subject attempting to access a snap.
 *
 * @param version - The received version value.
 * @returns `*` if the version is `undefined` or `latest", otherwise returns
 * the specified version.
 */
export function resolveVersionRange(version?: Json): SemVerRange {
  if (version === undefined || version === 'latest') {
    return DEFAULT_REQUESTED_SNAP_VERSION;
  }
  assertIsSemVerRange(version);
  return version;
}
