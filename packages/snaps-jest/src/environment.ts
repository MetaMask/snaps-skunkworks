import type {
  EnvironmentContext,
  JestEnvironmentConfig,
} from '@jest/environment';
import type { AbstractExecutionService } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';
import { installSnap } from '@metamask/snaps-simulation';
import type {
  InstalledSnap,
  InstallSnapOptions,
  SnapHelpers,
} from '@metamask/snaps-simulation';
import { assert, createModuleLogger } from '@metamask/utils';
import type { Server } from 'http';
import NodeEnvironment from 'jest-environment-node';
import type { AddressInfo } from 'net';

import { rootLogger, startServer } from './internals';
import type { SnapsEnvironmentOptions } from './options';
import { getOptions } from './options';

/* eslint-disable */
declare global {
  const snapsEnvironment: SnapsEnvironment;
}
/* eslint-enable */

const log = createModuleLogger(rootLogger, 'environment');

export class SnapsEnvironment extends NodeEnvironment {
  #options: SnapsEnvironmentOptions;

  #server: Server | undefined;

  #instance: (InstalledSnap & SnapHelpers) | undefined;

  /**
   * Constructor.
   *
   * @param options - The environment options.
   * @param context - The environment context.
   */
  constructor(options: JestEnvironmentConfig, context: EnvironmentContext) {
    super(options, context);
    this.#options = getOptions(options.projectConfig.testEnvironmentOptions);
  }

  /**
   * Set up the environment. This starts the built-in HTTP server, and creates a
   * new browser instance.
   */
  async setup() {
    await super.setup();

    if (this.#options.server.enabled) {
      log('Starting server.');
      this.#server = await startServer(this.#options.server);
    }

    this.global.snapsEnvironment = this;
  }

  /**
   * Tear down the environment. This closes the browser, and stops the built-in
   * HTTP server.
   */
  async teardown() {
    await this.#instance?.executionService.terminateAllSnaps();
    this.#server?.close();
    await super.teardown();
  }

  /**
   * Install a Snap in the environment. This will terminate any previously
   * installed Snaps, and run the Snap code in a new execution service.
   *
   * @param snapId - The ID of the Snap to install.
   * @param options - The options to use when installing the Snap.
   * @param options.executionService - The execution service to use.
   * @param options.executionServiceOptions - The options to use when creating the
   * execution service, if any. This should only include options specific to the
   * provided execution service.
   * @param options.options - The simulation options.
   * @template Service - The type of the execution service.
   * @returns The installed Snap.
   */
  async installSnap<
    Service extends new (
      ...args: any[]
    ) => InstanceType<typeof AbstractExecutionService>,
  >(
    snapId: string = this.snapId,
    options: Partial<InstallSnapOptions<Service>> = {},
  ) {
    await this.#instance?.executionService.terminateAllSnaps();
    this.#instance = await installSnap(snapId as SnapId, options);
    return this.#instance;
  }

  /**
   * Get the snap ID for the current environment, which is used if no snap ID is
   * passed to {@link installSnap}. This assumes that the built-in server is
   * running.
   *
   * @returns The snap ID.
   * @throws If the server is not running.
   */
  get snapId() {
    assert(
      this.#server,
      'You must specify a snap ID, because the built-in server is not running.',
    );

    const { port } = this.#server.address() as AddressInfo;
    return `local:http://localhost:${port}`;
  }
}

export default SnapsEnvironment;
