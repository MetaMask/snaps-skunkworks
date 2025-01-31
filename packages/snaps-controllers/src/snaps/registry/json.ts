import type {
  ControllerGetStateAction,
  ControllerStateChangeEvent,
  RestrictedMessenger,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { SnapsRegistryDatabase } from '@metamask/snaps-registry';
import { verify } from '@metamask/snaps-registry';
import { getTargetVersion } from '@metamask/snaps-utils';
import type { Hex, SemVerRange, SemVerVersion } from '@metamask/utils';
import {
  assert,
  assertIsSemVerRange,
  Duration,
  inMilliseconds,
  satisfiesVersionRange,
} from '@metamask/utils';

import type {
  SnapsRegistry,
  SnapsRegistryInfo,
  SnapsRegistryMetadata,
  SnapsRegistryRequest,
  SnapsRegistryResult,
} from './registry';
import { SnapsRegistryStatus } from './registry';

const SNAP_REGISTRY_URL =
  'https://acl.execution.metamask.io/latest/registry.json';

const SNAP_REGISTRY_SIGNATURE_URL =
  'https://acl.execution.metamask.io/latest/signature.json';

const DEFAULT_PUBLIC_KEY =
  '0x025b65308f0f0fb8bc7f7ff87bfc296e0330eee5d3c1d1ee4a048b2fd6a86fa0a6';

type JsonSnapsRegistryUrl = {
  registry: string;
  signature: string;
};

export type JsonSnapsRegistryArgs = {
  messenger: SnapsRegistryMessenger;
  state?: SnapsRegistryState;
  fetchFunction?: typeof fetch;
  url?: JsonSnapsRegistryUrl;
  recentFetchThreshold?: number;
  refetchOnAllowlistMiss?: boolean;
  publicKey?: Hex;
};

export type GetResult = {
  type: `${typeof controllerName}:get`;
  handler: SnapsRegistry['get'];
};

export type ResolveVersion = {
  type: `${typeof controllerName}:resolveVersion`;
  handler: SnapsRegistry['resolveVersion'];
};

export type GetMetadata = {
  type: `${typeof controllerName}:getMetadata`;
  handler: SnapsRegistry['getMetadata'];
};

export type Update = {
  type: `${typeof controllerName}:update`;
  handler: SnapsRegistry['update'];
};

export type SnapsRegistryGetStateAction = ControllerGetStateAction<
  typeof controllerName,
  SnapsRegistryState
>;

export type SnapsRegistryActions =
  | SnapsRegistryGetStateAction
  | GetResult
  | GetMetadata
  | Update
  | ResolveVersion;

export type SnapsRegistryStateChangeEvent = ControllerStateChangeEvent<
  typeof controllerName,
  SnapsRegistryState
>;

export type SnapsRegistryEvents = SnapsRegistryStateChangeEvent;

export type SnapsRegistryMessenger = RestrictedMessenger<
  'SnapsRegistry',
  SnapsRegistryActions,
  SnapsRegistryEvents,
  SnapsRegistryActions['type'],
  SnapsRegistryEvents['type']
>;

export type SnapsRegistryState = {
  database: SnapsRegistryDatabase | null;
  lastUpdated: number | null;
  databaseUnavailable: boolean;
};

const controllerName = 'SnapsRegistry';

const defaultState = {
  database: null,
  lastUpdated: null,
  databaseUnavailable: false,
};

export class JsonSnapsRegistry extends BaseController<
  typeof controllerName,
  SnapsRegistryState,
  SnapsRegistryMessenger
> {
  #url: JsonSnapsRegistryUrl;

  #publicKey: Hex;

  #fetchFunction: typeof fetch;

  #recentFetchThreshold: number;

  #refetchOnAllowlistMiss: boolean;

  #currentUpdate: Promise<void> | null;

  constructor({
    messenger,
    state,
    url = {
      registry: SNAP_REGISTRY_URL,
      signature: SNAP_REGISTRY_SIGNATURE_URL,
    },
    publicKey = DEFAULT_PUBLIC_KEY,
    fetchFunction = globalThis.fetch.bind(undefined),
    recentFetchThreshold = inMilliseconds(5, Duration.Minute),
    refetchOnAllowlistMiss = true,
  }: JsonSnapsRegistryArgs) {
    super({
      messenger,
      metadata: {
        database: { persist: true, anonymous: false },
        lastUpdated: { persist: true, anonymous: false },
        databaseUnavailable: { persist: true, anonymous: false },
      },
      name: controllerName,
      state: {
        ...defaultState,
        ...state,
      },
    });
    this.#url = url;
    this.#publicKey = publicKey;
    this.#fetchFunction = fetchFunction;
    this.#recentFetchThreshold = recentFetchThreshold;
    this.#refetchOnAllowlistMiss = refetchOnAllowlistMiss;
    this.#currentUpdate = null;

    this.messagingSystem.registerActionHandler(
      'SnapsRegistry:get',
      async (...args) => this.#get(...args),
    );

    this.messagingSystem.registerActionHandler(
      'SnapsRegistry:getMetadata',
      async (...args) => this.#getMetadata(...args),
    );

    this.messagingSystem.registerActionHandler(
      'SnapsRegistry:resolveVersion',
      async (...args) => this.#resolveVersion(...args),
    );

    this.messagingSystem.registerActionHandler(
      'SnapsRegistry:update',
      async () => this.#triggerUpdate(),
    );
  }

  #wasRecentlyFetched() {
    return (
      this.state.lastUpdated &&
      Date.now() - this.state.lastUpdated < this.#recentFetchThreshold
    );
  }

  /**
   * Triggers an update of the registry database.
   *
   * If an existing update is in progress this function will await that update.
   */
  async #triggerUpdate() {
    // If an update is ongoing, wait for that.
    if (this.#currentUpdate) {
      await this.#currentUpdate;
      return;
    }
    // If no update exists, create promise and store globally.
    if (this.#currentUpdate === null) {
      this.#currentUpdate = this.#update();
    }
    await this.#currentUpdate;
    this.#currentUpdate = null;
  }

  /**
   * Updates the registry database if the registry hasn't been updated recently.
   *
   * NOTE: SHOULD NOT be called directly, instead `triggerUpdate` should be used.
   */
  async #update() {
    // No-op if we recently fetched the registry.
    if (this.#wasRecentlyFetched()) {
      return;
    }

    try {
      const database = await this.#safeFetch(this.#url.registry);

      const signature = await this.#safeFetch(this.#url.signature);
      this.#verifySignature(database, signature);

      this.update((state) => {
        state.database = JSON.parse(database);
        state.lastUpdated = Date.now();
        state.databaseUnavailable = false;
      });
    } catch {
      // Ignore
      this.update((state) => {
        state.databaseUnavailable = true;
      });
    }
  }

  async #getDatabase(): Promise<SnapsRegistryDatabase | null> {
    if (this.state.database === null) {
      await this.#triggerUpdate();
    }

    return this.state.database;
  }

  async #getSingle(
    snapId: string,
    snapInfo: SnapsRegistryInfo,
    refetch = false,
  ): Promise<SnapsRegistryResult> {
    const database = await this.#getDatabase();

    const blockedEntry = database?.blockedSnaps.find((blocked) => {
      if ('id' in blocked) {
        return (
          blocked.id === snapId &&
          satisfiesVersionRange(snapInfo.version, blocked.versionRange)
        );
      }

      return blocked.checksum === snapInfo.checksum;
    });

    if (blockedEntry) {
      return {
        status: SnapsRegistryStatus.Blocked,
        reason: blockedEntry.reason,
      };
    }

    const verified = database?.verifiedSnaps[snapId];
    const version = verified?.versions?.[snapInfo.version];
    if (version && version.checksum === snapInfo.checksum) {
      return { status: SnapsRegistryStatus.Verified };
    }
    // For now, if we have an allowlist miss, we can refetch once and try again.
    if (this.#refetchOnAllowlistMiss && !refetch) {
      await this.#triggerUpdate();
      return this.#getSingle(snapId, snapInfo, true);
    }
    return {
      status: this.state.databaseUnavailable
        ? SnapsRegistryStatus.Unavailable
        : SnapsRegistryStatus.Unverified,
    };
  }

  async #get(
    snaps: SnapsRegistryRequest,
  ): Promise<Record<string, SnapsRegistryResult>> {
    return Object.entries(snaps).reduce<
      Promise<Record<string, SnapsRegistryResult>>
    >(async (previousPromise, [snapId, snapInfo]) => {
      const result = await this.#getSingle(snapId, snapInfo);
      const acc = await previousPromise;
      acc[snapId] = result;
      return acc;
    }, Promise.resolve({}));
  }

  /**
   * Find an allowlisted version within a specified version range. Otherwise return the version range itself.
   *
   * @param snapId - The ID of the snap we are trying to resolve a version for.
   * @param versionRange - The version range.
   * @param refetch - An optional flag used to determine if we are refetching the registry.
   * @returns An allowlisted version within the specified version range if available otherwise returns the input version range.
   */
  async #resolveVersion(
    snapId: string,
    versionRange: SemVerRange,
    refetch = false,
  ): Promise<SemVerRange> {
    const database = await this.#getDatabase();
    const versions = database?.verifiedSnaps[snapId]?.versions ?? null;

    if (!versions && this.#refetchOnAllowlistMiss && !refetch) {
      await this.#triggerUpdate();
      return this.#resolveVersion(snapId, versionRange, true);
    }

    // If we cannot narrow down the version range we return the unaltered version range.
    if (!versions) {
      return versionRange;
    }

    const targetVersion = getTargetVersion(
      Object.keys(versions) as SemVerVersion[],
      versionRange,
    );

    if (!targetVersion && this.#refetchOnAllowlistMiss && !refetch) {
      await this.#triggerUpdate();
      return this.#resolveVersion(snapId, versionRange, true);
    }

    // If we cannot narrow down the version range we return the unaltered version range.
    if (!targetVersion) {
      return versionRange;
    }

    // A semver version is technically also a valid semver range.
    assertIsSemVerRange(targetVersion);
    return targetVersion;
  }

  /**
   * Get metadata for the given snap ID.
   *
   * @param snapId - The ID of the snap to get metadata for.
   * @returns The metadata for the given snap ID, or `null` if the snap is not
   * verified.
   */
  async #getMetadata(snapId: string): Promise<SnapsRegistryMetadata | null> {
    const database = await this.#getDatabase();
    return database?.verifiedSnaps[snapId]?.metadata ?? null;
  }

  /**
   * Verify the signature of the registry.
   *
   * @param database - The registry database.
   * @param signature - The signature of the registry.
   * @throws If the signature is invalid.
   * @private
   */
  #verifySignature(database: string, signature: string) {
    assert(this.#publicKey, 'No public key provided.');

    const valid = verify({
      registry: database,
      signature: JSON.parse(signature),
      publicKey: this.#publicKey,
    });

    assert(valid, 'Invalid registry signature.');
  }

  /**
   * Fetch the given URL, throwing if the response is not OK.
   *
   * @param url - The URL to fetch.
   * @returns The response body.
   * @private
   */
  async #safeFetch(url: string) {
    const response = await this.#fetchFunction(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}.`);
    }

    return await response.text();
  }
}
