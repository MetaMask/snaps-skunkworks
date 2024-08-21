import type { RestrictedControllerMessenger } from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import {
  getCronjobCaveatJobs,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { SnapId } from '@metamask/snaps-sdk';
import type {
  TruncatedSnap,
  CronjobSpecification,
} from '@metamask/snaps-utils';
import {
  HandlerType,
  parseCronExpression,
  logError,
} from '@metamask/snaps-utils';
import { Duration, inMilliseconds } from '@metamask/utils';

import type {
  GetAllSnaps,
  HandleSnapRequest,
  SnapDisabled,
  SnapEnabled,
  SnapInstalled,
  SnapUninstalled,
  SnapUpdated,
} from '..';
import { getRunnableSnaps } from '..';
import { Timer } from '../snaps/Timer';

export type CronjobControllerActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions;

export type CronjobControllerEvents =
  | SnapInstalled
  | SnapUninstalled
  | SnapUpdated
  | SnapEnabled
  | SnapDisabled;

export type CronjobControllerMessenger = RestrictedControllerMessenger<
  'CronjobController',
  CronjobControllerActions,
  CronjobControllerEvents,
  CronjobControllerActions['type'],
  CronjobControllerEvents['type']
>;

export const DAILY_TIMEOUT = inMilliseconds(24, Duration.Hour);

export type CronjobControllerArgs = {
  messenger: CronjobControllerMessenger;
  /**
   * Persisted state that will be used for rehydration.
   */
  state?: CronjobControllerState;
};

export type Cronjob = {
  timer?: Timer;
  id: string;
  snapId: SnapId;
} & CronjobSpecification;

export type StoredJobInformation = {
  lastRun: number;
};

export type CronjobControllerState = {
  jobs: Record<string, StoredJobInformation>;
};

const controllerName = 'CronjobController';

/**
 * Use this controller to register and schedule periodically executed jobs
 * using RPC method hooks.
 */
export class CronjobController extends BaseController<
  typeof controllerName,
  CronjobControllerState,
  CronjobControllerMessenger
> {
  readonly #messenger: CronjobControllerMessenger;

  #dailyTimer!: Timer;

  readonly #timers: Map<string, Timer>;

  // Mapping from jobId to snapId
  readonly #snapIds: Map<string, string>;

  constructor({ messenger, state }: CronjobControllerArgs) {
    super({
      messenger,
      metadata: {
        jobs: { persist: true, anonymous: false },
      },
      name: controllerName,
      state: {
        jobs: {},
        ...state,
      },
    });
    this.#timers = new Map();
    this.#snapIds = new Map();
    this.#messenger = messenger;

    this._handleSnapRegisterEvent = this._handleSnapRegisterEvent.bind(this);
    this._handleSnapUnregisterEvent =
      this._handleSnapUnregisterEvent.bind(this);
    this._handleEventSnapUpdated = this._handleEventSnapUpdated.bind(this);

    // Subscribe to Snap events
    /* eslint-disable @typescript-eslint/unbound-method */
    this.messagingSystem.subscribe(
      'SnapController:snapInstalled',
      this._handleSnapRegisterEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapUninstalled',
      this._handleSnapUnregisterEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapEnabled',
      this._handleSnapRegisterEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapDisabled',
      this._handleSnapUnregisterEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapUpdated',
      this._handleEventSnapUpdated,
    );
    /* eslint-enable @typescript-eslint/unbound-method */

    this.dailyCheckIn().catch((error) => {
      logError(error);
    });
  }

  /**
   * Retrieve all cronjob specifications for all runnable snaps.
   *
   * @returns Array of Cronjob specifications.
   */
  private getAllJobs(): Cronjob[] {
    const snaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(snaps);

    const jobs = filteredSnaps.map((snap) => this.getSnapJobs(snap.id));
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return jobs.flat().filter((job) => job !== undefined) as Cronjob[];
  }

  /**
   * Retrieve all Cronjob specifications for a Snap.
   *
   * @param snapId - ID of a Snap.
   * @returns Array of Cronjob specifications.
   */
  private getSnapJobs(snapId: SnapId): Cronjob[] | undefined {
    const permissions = this.#messenger.call(
      'PermissionController:getPermissions',
      snapId,
    );

    const permission = permissions?.[SnapEndowments.Cronjob];
    const definitions = getCronjobCaveatJobs(permission);

    return definitions?.map((definition, idx) => {
      return { ...definition, id: `${snapId}-${idx}`, snapId };
    });
  }

  /**
   * Register cron jobs for a given snap by getting specification from a permission caveats.
   * Once registered, each job will be scheduled.
   *
   * @param snapId - ID of a snap.
   */
  register(snapId: SnapId) {
    const jobs = this.getSnapJobs(snapId);
    jobs?.forEach((job) => this.schedule(job));
  }

  /**
   * Schedule a new job.
   * This will interpret the cron expression and tell the timer to execute the job
   * at the next suitable point in time.
   * Job last run state will be initialized afterwards.
   *
   * Note: Schedule will be skipped if the job's execution time is too far in the future and
   * will be revisited on a daily check.
   *
   * @param job - Cronjob specification.
   */
  private schedule(job: Cronjob) {
    if (this.#timers.has(job.id)) {
      return;
    }

    const parsed = parseCronExpression(job.expression);
    const next = parsed.next();
    const now = new Date();
    const ms = next.getTime() - now.getTime();

    // Don't schedule this job yet as it is too far in the future
    if (ms > DAILY_TIMEOUT) {
      return;
    }

    const timer = new Timer(ms);
    timer.start(() => {
      this.executeCronjob(job).catch((error) => {
        // TODO: Decide how to handle errors.
        logError(error);
      });

      this.#timers.delete(job.id);
      this.schedule(job);
    });

    if (!this.state.jobs[job.id]?.lastRun) {
      this.updateJobLastRunState(job.id, 0); // 0 for init, never ran actually
    }

    this.#timers.set(job.id, timer);
    this.#snapIds.set(job.id, job.snapId);
  }

  /**
   * Execute job.
   *
   * @param job - Cronjob specification.
   */
  private async executeCronjob(job: Cronjob) {
    this.updateJobLastRunState(job.id, Date.now());
    await this.#messenger.call('SnapController:handleRequest', {
      snapId: job.snapId,
      origin: '',
      handler: HandlerType.OnCronjob,
      request: job.request,
    });
  }

  /**
   * Unregister all jobs related to the given snapId.
   *
   * @param snapId - ID of a snap.
   */
  unregister(snapId: string) {
    const jobs = [...this.#snapIds.entries()].filter(
      ([_, jobSnapId]) => jobSnapId === snapId,
    );

    if (jobs.length) {
      jobs.forEach(([id]) => {
        const timer = this.#timers.get(id);
        if (timer) {
          timer.cancel();
          this.#timers.delete(id);
          this.#snapIds.delete(id);
        }
      });
    }
  }

  /**
   * Update time of a last run for the Cronjob specified by ID.
   *
   * @param jobId - ID of a cron job.
   * @param lastRun - Unix timestamp when the job was last ran.
   */
  private updateJobLastRunState(jobId: string, lastRun: number) {
    this.update((state) => {
      state.jobs[jobId] = {
        lastRun,
      };
    });
  }

  /**
   * Runs every 24 hours to check if new jobs need to be scheduled.
   *
   * This is necessary for longer running jobs that execute with more than 24 hours between them.
   */
  async dailyCheckIn() {
    const jobs = this.getAllJobs();

    for (const job of jobs) {
      const parsed = parseCronExpression(job.expression);
      const lastRun = this.state.jobs[job.id]?.lastRun;
      // If a job was supposed to run while we were shut down but wasn't we run it now
      if (
        lastRun !== undefined &&
        parsed.hasPrev() &&
        parsed.prev().getTime() > lastRun
      ) {
        await this.executeCronjob(job);
      }

      // Try scheduling, will fail if an existing scheduled job is found
      this.schedule(job);
    }

    this.#dailyTimer = new Timer(DAILY_TIMEOUT);
    this.#dailyTimer.start(() => {
      this.dailyCheckIn().catch((error) => {
        // TODO: Decide how to handle errors.
        logError(error);
      });
    });
  }

  /**
   * Run controller teardown process and unsubscribe from Snap events.
   */
  destroy() {
    super.destroy();

    /* eslint-disable @typescript-eslint/unbound-method */
    this.messagingSystem.unsubscribe(
      'SnapController:snapInstalled',
      this._handleSnapRegisterEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapUninstalled',
      this._handleSnapUnregisterEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapEnabled',
      this._handleSnapRegisterEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapDisabled',
      this._handleSnapUnregisterEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapUpdated',
      this._handleEventSnapUpdated,
    );
    /* eslint-enable @typescript-eslint/unbound-method */

    this.#snapIds.forEach((snapId) => {
      this.unregister(snapId);
    });
  }

  /**
   * Handle events that should cause cronjobs to be registered.
   *
   * @param snap - Basic Snap information.
   */
  private _handleSnapRegisterEvent(snap: TruncatedSnap) {
    this.register(snap.id);
  }

  /**
   * Handle events that should cause cronjobs to be unregistered.
   *
   * @param snap - Basic Snap information.
   */
  private _handleSnapUnregisterEvent(snap: TruncatedSnap) {
    this.unregister(snap.id);
  }

  /**
   * Handle cron jobs on 'snapUpdated' event.
   *
   * @param snap - Basic Snap information.
   */
  private _handleEventSnapUpdated(snap: TruncatedSnap) {
    this.unregister(snap.id);
    this.register(snap.id);
  }
}
