import type {
  RestrictedControllerMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import {
  getCronjobCaveatJobs,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { BackgroundEvent, SnapId } from '@metamask/snaps-sdk';
import type {
  TruncatedSnap,
  CronjobSpecification,
} from '@metamask/snaps-utils';
import {
  HandlerType,
  parseCronExpression,
  logError,
  logWarning,
} from '@metamask/snaps-utils';
import { assert, Duration, inMilliseconds } from '@metamask/utils';
import { castDraft } from 'immer';
import { DateTime } from 'luxon';
import { nanoid } from 'nanoid';

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

export type CronjobControllerGetStateAction = ControllerGetStateAction<
  typeof controllerName,
  CronjobControllerState
>;
export type CronjobControllerStateChangeEvent = ControllerStateChangeEvent<
  typeof controllerName,
  CronjobControllerState
>;

export type ScheduleBackgroundEvent = {
  type: `${typeof controllerName}:scheduleBackgroundEvent`;
  handler: CronjobController['scheduleBackgroundEvent'];
};

export type CancelBackgroundEvent = {
  type: `${typeof controllerName}:cancelBackgroundEvent`;
  handler: CronjobController['cancelBackgroundEvent'];
};

export type GetBackgroundEvents = {
  type: `${typeof controllerName}:getBackgroundEvents`;
  handler: CronjobController['getBackgroundEvents'];
};

export type CronjobControllerActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | CronjobControllerGetStateAction
  | ScheduleBackgroundEvent
  | CancelBackgroundEvent
  | GetBackgroundEvents;

export type CronjobControllerEvents =
  | SnapInstalled
  | SnapUninstalled
  | SnapUpdated
  | SnapEnabled
  | SnapDisabled
  | CronjobControllerStateChangeEvent;

export type CronjobControllerMessenger = RestrictedControllerMessenger<
  typeof controllerName,
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
  events: Record<string, BackgroundEvent>;
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
  #dailyTimer!: Timer;

  #timers: Map<string, Timer>;

  // Mapping from jobId to snapId
  #snapIds: Map<string, SnapId>;

  constructor({ messenger, state }: CronjobControllerArgs) {
    super({
      messenger,
      metadata: {
        jobs: { persist: true, anonymous: false },
        events: { persist: true, anonymous: false },
      },
      name: controllerName,
      state: {
        jobs: {},
        events: {},
        ...state,
      },
    });
    this.#timers = new Map();
    this.#snapIds = new Map();

    this._handleSnapRegisterEvent = this._handleSnapRegisterEvent.bind(this);
    this._handleSnapUnregisterEvent =
      this._handleSnapUnregisterEvent.bind(this);
    this._handleEventSnapUpdated = this._handleEventSnapUpdated.bind(this);
    this._handleSnapDisabledEvent = this._handleSnapDisabledEvent.bind(this);
    this._handleSnapEnabledEvent = this._handleSnapEnabledEvent.bind(this);

    // Subscribe to Snap events
    this.#initializeEventListeners();

    // Register action handlers
    this.#initializeActionHandlers();

    this.dailyCheckIn().catch((error) => {
      logError(error);
    });

    this.#rescheduleBackgroundEvents(Object.values(this.state.events));
  }

  /**
   * Initialize event listeners.
   */
  #initializeEventListeners() {
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
      this._handleSnapEnabledEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapDisabled',
      this._handleSnapDisabledEvent,
    );

    this.messagingSystem.subscribe(
      'SnapController:snapUpdated',
      this._handleEventSnapUpdated,
    );
    /* eslint-disable @typescript-eslint/unbound-method */
  }

  /**
   * Initialize action handlers.
   */
  #initializeActionHandlers() {
    this.messagingSystem.registerActionHandler(
      `${controllerName}:scheduleBackgroundEvent`,
      (...args) => this.scheduleBackgroundEvent(...args),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:cancelBackgroundEvent`,
      (...args) => this.cancelBackgroundEvent(...args),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:getBackgroundEvents`,
      (...args) => this.getBackgroundEvents(...args),
    );
  }

  /**
   * Execute a request.
   *
   * @param snapId - ID of a Snap.
   * @param request - Request to be executed.
   */
  async #executeRequest(snapId: SnapId, request: unknown) {
    await this.messagingSystem
      .call('SnapController:handleRequest', {
        snapId,
        origin: '',
        handler: HandlerType.OnCronjob,
        request: request as Record<string, unknown>,
      })
      .catch((error) => {
        logError(error);
      });
  }

  /**
   * Setup a timer.
   *
   * @param id - ID of a timer.
   * @param ms - Time in milliseconds.
   * @param snapId - ID of a Snap.
   * @param onComplete - Callback function to be executed when the timer completes.
   * @param validateTime - Whether the time should be validated.
   */
  #setupTimer(
    id: string,
    ms: number,
    snapId: SnapId,
    onComplete: () => void,
    validateTime = true,
  ) {
    if (validateTime && ms <= 0) {
      throw new Error('Cannot schedule execution in the past.');
    }

    const timer = new Timer(ms);
    timer.start(() => {
      onComplete();
      this.#timers.delete(id);
      this.#snapIds.delete(id);
    });

    this.#timers.set(id, timer);
    this.#snapIds.set(id, snapId);
  }

  /**
   * Cleanup a timer.
   *
   * @param id - ID of a timer.
   */
  #cleanupTimer(id: string) {
    const timer = this.#timers.get(id);
    if (timer) {
      timer.cancel();
      this.#timers.delete(id);
      this.#snapIds.delete(id);
    }
  }

  /**
   * Retrieve all cronjob specifications for all runnable snaps.
   *
   * @returns Array of Cronjob specifications.
   */
  #getAllJobs(): Cronjob[] {
    const snaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(snaps);

    const jobs = filteredSnaps.map((snap) => this.#getSnapJobs(snap.id));
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return jobs.flat().filter((job) => job !== undefined) as Cronjob[];
  }

  /**
   * Retrieve all Cronjob specifications for a Snap.
   *
   * @param snapId - ID of a Snap.
   * @returns Array of Cronjob specifications.
   */
  #getSnapJobs(snapId: SnapId): Cronjob[] | undefined {
    const permissions = this.messagingSystem.call(
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
    const jobs = this.#getSnapJobs(snapId);
    jobs?.forEach((job) => this.#schedule(job));
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
  #schedule(job: Cronjob) {
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

    this.#setupTimer(
      job.id,
      ms,
      job.snapId,
      () => {
        // TODO: Decide how to handle errors.
        this.#executeCronjob(job).catch(logError);
        this.#schedule(job);
      },
      false,
    );

    if (!this.state.jobs[job.id]?.lastRun) {
      this.#updateJobLastRunState(job.id, 0); // 0 for init, never ran actually
    }
  }

  /**
   * Execute job.
   *
   * @param job - Cronjob specification.
   */
  async #executeCronjob(job: Cronjob) {
    this.#updateJobLastRunState(job.id, Date.now());
    await this.#executeRequest(job.snapId, job.request);
  }

  /**
   * Schedule a background event.
   *
   * @param backgroundEventWithoutId - Background event.
   * @returns An id representing the background event.
   */
  scheduleBackgroundEvent(
    backgroundEventWithoutId: Omit<BackgroundEvent, 'id' | 'scheduledAt'>,
  ) {
    // Remove millisecond precision and convert to UTC.
    const scheduledAt = DateTime.fromJSDate(new Date())
      .toUTC()
      .startOf('second')
      .toISO({
        suppressMilliseconds: true,
      });

    assert(scheduledAt);

    const event = {
      ...backgroundEventWithoutId,
      id: nanoid(),
      scheduledAt,
    };

    this.#setUpBackgroundEvent(event);
    this.update((state) => {
      state.events[event.id] = castDraft(event);
    });

    return event.id;
  }

  /**
   * Cancel a background event.
   *
   * @param origin - The origin making the cancel call.
   * @param id - The id of the background event to cancel.
   * @throws If the event does not exist.
   */
  cancelBackgroundEvent(origin: string, id: string) {
    assert(
      this.state.events[id],
      `A background event with the id of "${id}" does not exist.`,
    );

    assert(
      this.state.events[id].snapId === origin,
      'Only the origin that scheduled this event can cancel it.',
    );

    this.#cleanupTimer(id);
    this.update((state) => {
      delete state.events[id];
    });
  }

  /**
   * A helper function to handle setup of the background event.
   *
   * @param event - A background event.
   */
  #setUpBackgroundEvent(event: BackgroundEvent) {
    const date = new Date(event.date);
    const now = new Date();
    const ms = date.getTime() - now.getTime();

    this.#setupTimer(event.id, ms, event.snapId, () => {
      this.#executeRequest(event.snapId, event.request).catch(logError);
      this.update((state) => {
        delete state.events[event.id];
      });
    });
  }

  /**
   * Get a list of a Snap's background events.
   *
   * @param snapId - The id of the Snap to fetch background events for.
   * @returns An array of background events.
   */
  getBackgroundEvents(snapId: SnapId): BackgroundEvent[] {
    return Object.values(this.state.events).filter(
      (snapEvent) => snapEvent.snapId === snapId,
    );
  }

  /**
   * Unregister all jobs and background events related to the given snapId.
   *
   * @param snapId - ID of a snap.
   * @param skipEvents - Whether the unregistration process should skip scheduled background events.
   */
  unregister(snapId: SnapId, skipEvents = false) {
    const jobs = [...this.#snapIds.entries()].filter(
      ([_, jobSnapId]) => jobSnapId === snapId,
    );

    if (jobs.length) {
      const eventIds: string[] = [];
      jobs.forEach(([id]) => {
        const timer = this.#timers.get(id);
        if (timer) {
          timer.cancel();
          this.#timers.delete(id);
          this.#snapIds.delete(id);
          if (!skipEvents && this.state.events[id]) {
            eventIds.push(id);
          }
        }
      });

      if (eventIds.length > 0) {
        this.update((state) => {
          eventIds.forEach((id) => {
            delete state.events[id];
          });
        });
      }
    }
  }

  /**
   * Update time of a last run for the Cronjob specified by ID.
   *
   * @param jobId - ID of a cron job.
   * @param lastRun - Unix timestamp when the job was last ran.
   */
  #updateJobLastRunState(jobId: string, lastRun: number) {
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
    const jobs = this.#getAllJobs();

    for (const job of jobs) {
      const parsed = parseCronExpression(job.expression);
      const lastRun = this.state.jobs[job.id]?.lastRun;
      // If a job was supposed to run while we were shut down but wasn't we run it now
      if (
        lastRun !== undefined &&
        parsed.hasPrev() &&
        parsed.prev().getTime() > lastRun
      ) {
        await this.#executeCronjob(job);
      }

      // Try scheduling, will fail if an existing scheduled job is found
      this.#schedule(job);
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
   * Reschedule background events.
   *
   * @param backgroundEvents - A list of background events to reschdule.
   */
  #rescheduleBackgroundEvents(backgroundEvents: BackgroundEvent[]) {
    for (const snapEvent of backgroundEvents) {
      const { date } = snapEvent;
      const now = new Date();
      const then = new Date(date);
      if (then.getTime() < now.getTime()) {
        // Remove expired events from state
        this.update((state) => {
          delete state.events[snapEvent.id];
        });

        logWarning(
          `Background event with id "${snapEvent.id}" not scheduled as its date has expired.`,
        );
      } else {
        this.#setUpBackgroundEvent(snapEvent);
      }
    }
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
      this._handleSnapEnabledEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapDisabled',
      this._handleSnapDisabledEvent,
    );

    this.messagingSystem.unsubscribe(
      'SnapController:snapUpdated',
      this._handleEventSnapUpdated,
    );
    /* eslint-enable @typescript-eslint/unbound-method */

    this.#snapIds.forEach((snapId) => this.unregister(snapId));
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
   * Handle events that could cause cronjobs to be registered
   * and for background events to be rescheduled.
   *
   * @param snap - Basic Snap information.
   */
  private _handleSnapEnabledEvent(snap: TruncatedSnap) {
    const events = this.getBackgroundEvents(snap.id);
    this.#rescheduleBackgroundEvents(events);
    this.register(snap.id);
  }

  /**
   * Handle events that should cause cronjobs and background events to be unregistered.
   *
   * @param snap - Basic Snap information.
   */
  private _handleSnapUnregisterEvent(snap: TruncatedSnap) {
    this.unregister(snap.id);
  }

  /**
   * Handle events that should cause cronjobs and background events to be unregistered.
   *
   * @param snap - Basic Snap information.
   */
  private _handleSnapDisabledEvent(snap: TruncatedSnap) {
    this.unregister(snap.id, true);
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
