import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import { createStreamMiddleware } from '@metamask/json-rpc-middleware-stream';
import ObjectMultiplex from '@metamask/object-multiplex';
import type { BasePostMessageStream } from '@metamask/post-message-stream';
import { JsonRpcError } from '@metamask/rpc-errors';
import type { SnapRpcHook, SnapRpcHookArgs } from '@metamask/snaps-utils';
import { SNAP_STREAM_NAMES, logError } from '@metamask/snaps-utils';
import type {
  Json,
  JsonRpcNotification,
  JsonRpcRequest,
} from '@metamask/utils';
import {
  Duration,
  assertIsJsonRpcRequest,
  inMilliseconds,
  isJsonRpcFailure,
  isJsonRpcNotification,
  isObject,
} from '@metamask/utils';
import { nanoid } from 'nanoid';
import { pipeline } from 'readable-stream';
import type { Duplex } from 'readable-stream';

import type {
  ExecutionService,
  ExecutionServiceMessenger,
  SnapErrorJson,
  SnapExecutionData,
} from './ExecutionService';
import { log } from '../logging';
import { Timer } from '../snaps/Timer';
import { hasTimedOut, withTimeout } from '../utils';

const controllerName = 'ExecutionService';

export type SetupSnapProvider = (snapId: string, stream: Duplex) => void;

export type ExecutionServiceArgs = {
  setupSnapProvider: SetupSnapProvider;
  messenger: ExecutionServiceMessenger;
  initTimeout?: number;
  pingTimeout?: number;
  terminationTimeout?: number;
  usePing?: boolean;
};

export type JobStreams = {
  command: Duplex;
  rpc: Duplex;
  _connection: BasePostMessageStream;
};

export type Job<WorkerType> = {
  id: string;
  streams: JobStreams;
  rpcEngine: JsonRpcEngine;
  worker: WorkerType;
};

export type TerminateJobArgs<WorkerType> = Partial<Job<WorkerType>> &
  Pick<Job<WorkerType>, 'id'>;

export abstract class AbstractExecutionService<WorkerType>
  implements ExecutionService
{
  readonly #snapRpcHooks: Map<string, SnapRpcHook>;

  // Cannot be hash private yet because of tests.
  protected jobs: Map<string, Job<WorkerType>>;

  // Cannot be hash private yet because of tests.
  private readonly setupSnapProvider: SetupSnapProvider;

  readonly #snapToJobMap: Map<string, string>;

  readonly #jobToSnapMap: Map<string, string>;

  readonly #messenger: ExecutionServiceMessenger;

  readonly #initTimeout: number;

  readonly #pingTimeout: number;

  readonly #terminationTimeout: number;

  readonly #usePing: boolean;

  constructor({
    setupSnapProvider,
    messenger,
    initTimeout = inMilliseconds(60, Duration.Second),
    pingTimeout = inMilliseconds(2, Duration.Second),
    terminationTimeout = inMilliseconds(1, Duration.Second),
    usePing = true,
  }: ExecutionServiceArgs) {
    this.#snapRpcHooks = new Map();
    this.jobs = new Map();
    this.setupSnapProvider = setupSnapProvider;
    this.#snapToJobMap = new Map();
    this.#jobToSnapMap = new Map();
    this.#messenger = messenger;
    this.#initTimeout = initTimeout;
    this.#pingTimeout = pingTimeout;
    this.#terminationTimeout = terminationTimeout;
    this.#usePing = usePing;

    this.registerMessageHandlers();
  }

  /**
   * Constructor helper for registering the controller's messaging system
   * actions.
   */
  private registerMessageHandlers(): void {
    this.#messenger.registerActionHandler(
      `${controllerName}:handleRpcRequest`,
      async (snapId: string, options: SnapRpcHookArgs) =>
        this.handleRpcRequest(snapId, options),
    );

    this.#messenger.registerActionHandler(
      `${controllerName}:executeSnap`,
      async (data: SnapExecutionData) => this.executeSnap(data),
    );

    this.#messenger.registerActionHandler(
      `${controllerName}:terminateSnap`,
      async (snapId: string) => this.terminateSnap(snapId),
    );

    this.#messenger.registerActionHandler(
      `${controllerName}:terminateAllSnaps`,
      async () => this.terminateAllSnaps(),
    );
  }

  /**
   * Performs additional necessary work during job termination. **MUST** be
   * implemented by concrete implementations. See
   * {@link AbstractExecutionService.terminate} for details.
   *
   * @param job - The object corresponding to the job to be terminated.
   */
  protected abstract terminateJob(job: TerminateJobArgs<WorkerType>): void;

  /**
   * Terminates the job with the specified ID and deletes all its associated
   * data. Any subsequent messages targeting the job will fail with an error.
   * Throws an error if the specified job does not exist, or if termination
   * fails unexpectedly.
   *
   * @param jobId - The id of the job to be terminated.
   */
  public async terminate(jobId: string): Promise<void> {
    const jobWrapper = this.jobs.get(jobId);
    if (!jobWrapper) {
      throw new Error(`Job with id "${jobId}" not found.`);
    }

    try {
      // Ping worker and tell it to run teardown, continue with termination if it takes too long
      const result = await withTimeout(
        this.command(jobId, {
          jsonrpc: '2.0',
          method: 'terminate',
          params: [],
          id: nanoid(),
        }),
        this.#terminationTimeout,
      );

      if (result === hasTimedOut || result !== 'OK') {
        // We tried to shutdown gracefully but failed. This probably means the Snap is in infinite loop and
        // hogging down the whole JS process.
        // TODO(ritave): It might be doing weird things such as posting a lot of setTimeouts. Add a test to ensure that this behaviour
        //               doesn't leak into other workers. Especially important in IframeExecutionEnvironment since they all share the same
        //               JS process.
        logError(`Job "${jobId}" failed to terminate gracefully.`, result);
      }
    } catch {
      // Ignore
    }

    Object.values(jobWrapper.streams).forEach((stream) => {
      try {
        !stream.destroyed && stream.destroy();
        stream.removeAllListeners();
      } catch (error) {
        logError('Error while destroying stream', error);
      }
    });

    this.terminateJob(jobWrapper);

    this.jobs.delete(jobId);
    this.#removeSnapAndJobMapping(jobId);
    log(`Job "${jobId}" terminated.`);
  }

  /**
   * Initiates a job for a snap.
   *
   * @param jobId - The ID of the job to initiate.
   * @param timer - The timer to use for timeouts.
   * @returns Information regarding the created job.
   * @throws If the execution service returns an error or execution times out.
   */
  protected async initJob(
    jobId: string,
    timer: Timer,
  ): Promise<Job<WorkerType>> {
    const { streams, worker } = await this.initStreams(jobId, timer);
    const rpcEngine = new JsonRpcEngine();

    const jsonRpcConnection = createStreamMiddleware();

    pipeline(
      jsonRpcConnection.stream,
      streams.command,
      jsonRpcConnection.stream,
      (error) => {
        if (error) {
          logError(`Command stream failure.`, error);
        }
      },
    );

    rpcEngine.push(jsonRpcConnection.middleware);

    const envMetadata = {
      id: jobId,
      streams,
      rpcEngine,
      worker,
    };
    this.jobs.set(jobId, envMetadata);

    return envMetadata;
  }

  /**
   * Sets up the streams for an initiated job.
   *
   * @param jobId - The id of the job.
   * @param timer - The timer to use for timeouts.
   * @returns The streams to communicate with the worker and the worker itself.
   * @throws If the execution service returns an error or execution times out.
   */
  protected async initStreams(
    jobId: string,
    timer: Timer,
  ): Promise<{ streams: JobStreams; worker: WorkerType }> {
    const result = await withTimeout(this.initEnvStream(jobId), timer);

    if (result === hasTimedOut) {
      // For certain environments, such as the iframe we may have already created the worker and wish to terminate it.
      this.terminateJob({ id: jobId });
      throw new Error('The Snaps execution environment failed to start.');
    }

    const { worker, stream: envStream } = result;
    const mux = setupMultiplex(envStream, `Job: "${jobId}"`);
    const commandStream = mux.createStream(SNAP_STREAM_NAMES.COMMAND);

    // Handle out-of-band errors, i.e. errors thrown from the snap outside of the req/res cycle.
    // Also keep track of outbound request/responses
    const notificationHandler = (
      message:
        | JsonRpcRequest
        | JsonRpcNotification<Json[] | Record<string, Json>>,
    ) => {
      if (!isJsonRpcNotification(message)) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const snapId = this.#jobToSnapMap.get(jobId)!;
      if (message.method === 'OutboundRequest') {
        this.#messenger.publish('ExecutionService:outboundRequest', snapId);
      } else if (message.method === 'OutboundResponse') {
        this.#messenger.publish('ExecutionService:outboundResponse', snapId);
      } else if (message.method === 'UnhandledError') {
        if (isObject(message.params) && message.params.error) {
          this.#messenger.publish(
            'ExecutionService:unhandledError',
            snapId,
            message.params.error as SnapErrorJson,
          );
          commandStream.removeListener('data', notificationHandler);
        } else {
          logError(
            new Error(
              `Received malformed "${message.method}" command stream notification.`,
            ),
          );
        }
      } else {
        logError(
          new Error(
            `Received unexpected command stream notification "${message.method}".`,
          ),
        );
      }
    };

    commandStream.on('data', notificationHandler);
    const rpcStream = mux.createStream(SNAP_STREAM_NAMES.JSON_RPC);

    // Typecast: stream type mismatch
    return {
      streams: {
        command: commandStream,
        rpc: rpcStream,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _connection: envStream,
      },
      worker,
    };
  }

  /**
   * Abstract function implemented by implementing class that spins up a new worker for a job.
   *
   * Depending on the execution environment, this may run forever if the Snap fails to start up properly, therefore any call to this function should be wrapped in a timeout.
   */
  protected abstract initEnvStream(jobId: string): Promise<{
    worker: WorkerType;
    stream: BasePostMessageStream;
  }>;

  /**
   * Terminates the Snap with the specified ID. May throw an error if
   * termination unexpectedly fails, but will not fail if no job for the snap
   * with the specified ID is found.
   *
   * @param snapId - The ID of the snap to terminate.
   */
  async terminateSnap(snapId: string) {
    const jobId = this.#snapToJobMap.get(snapId);
    if (jobId) {
      await this.terminate(jobId);
    }
  }

  async terminateAllSnaps() {
    await Promise.all(
      [...this.jobs.keys()].map(async (jobId) => this.terminate(jobId)),
    );
    this.#snapRpcHooks.clear();
  }

  /**
   * Gets the RPC request handler for the given snap.
   *
   * @param snapId - The id of the Snap whose message handler to get.
   * @returns The RPC request handler for the snap.
   */
  private getRpcRequestHandler(snapId: string) {
    return this.#snapRpcHooks.get(snapId);
  }

  /**
   * Initializes and executes a snap, setting up the communication channels to the snap etc.
   *
   * @param snapData - Data needed for Snap execution.
   * @param snapData.snapId - The ID of the Snap to execute.
   * @param snapData.sourceCode - The source code of the Snap to execute.
   * @param snapData.endowments - The endowments available to the executing Snap.
   * @returns A string `OK` if execution succeeded.
   * @throws If the execution service returns an error or execution times out.
   */
  async executeSnap({
    snapId,
    sourceCode,
    endowments,
  }: SnapExecutionData): Promise<string> {
    if (this.#snapToJobMap.has(snapId)) {
      throw new Error(`Snap "${snapId}" is already being executed.`);
    }

    const jobId = nanoid();
    const timer = new Timer(this.#initTimeout);

    // This may resolve even if the environment has failed to start up fully
    const job = await this.initJob(jobId, timer);

    this.#mapSnapAndJob(snapId, job.id);

    // Certain environments use ping as part of their initialization and thus can skip it here
    if (this.#usePing) {
      // Ping the worker to ensure that it started up
      const pingResult = await withTimeout(
        this.command(job.id, {
          jsonrpc: '2.0',
          method: 'ping',
          id: nanoid(),
        }),
        this.#pingTimeout,
      );

      if (pingResult === hasTimedOut) {
        throw new Error('The Snaps execution environment failed to start.');
      }
    }

    const rpcStream = job.streams.rpc;

    this.setupSnapProvider(snapId, rpcStream);

    const remainingTime = timer.remaining;

    const result = await withTimeout(
      this.command(job.id, {
        jsonrpc: '2.0',
        method: 'executeSnap',
        params: { snapId, sourceCode, endowments },
        id: nanoid(),
      }),
      remainingTime,
    );

    if (result === hasTimedOut) {
      throw new Error(`${snapId} failed to start.`);
    }

    this.#createSnapHooks(snapId, job.id);
    return result as string;
  }

  // Cannot be hash private yet because of tests.
  private async command(
    jobId: string,
    message: JsonRpcRequest,
  ): Promise<Json | undefined> {
    assertIsJsonRpcRequest(message);

    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job with id "${jobId}" not found.`);
    }

    log('Parent: Sending Command', message);
    // eslint is blocking `await` usage even though `handle` overload returns a promise.
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const response = await job.rpcEngine.handle(message);

    if (isJsonRpcFailure(response)) {
      throw new JsonRpcError(
        response.error.code,
        response.error.message,
        response.error.data,
      );
    }

    return response.result;
  }

  #removeSnapHooks(snapId: string) {
    this.#snapRpcHooks.delete(snapId);
  }

  #createSnapHooks(snapId: string, workerId: string) {
    const rpcHook = async ({ origin, handler, request }: SnapRpcHookArgs) => {
      return await this.command(workerId, {
        id: nanoid(),
        jsonrpc: '2.0',
        method: 'snapRpc',
        params: {
          origin,
          handler,
          request: request as JsonRpcRequest,
          target: snapId,
        },
      });
    };

    this.#snapRpcHooks.set(snapId, rpcHook);
  }

  #mapSnapAndJob(snapId: string, jobId: string): void {
    this.#snapToJobMap.set(snapId, jobId);
    this.#jobToSnapMap.set(jobId, snapId);
  }

  #removeSnapAndJobMapping(jobId: string): void {
    const snapId = this.#jobToSnapMap.get(jobId);
    if (!snapId) {
      throw new Error(`job: "${jobId}" has no mapped snap.`);
    }

    this.#jobToSnapMap.delete(jobId);
    this.#snapToJobMap.delete(snapId);
    this.#removeSnapHooks(snapId);
  }

  /**
   * Handle RPC request.
   *
   * @param snapId - The ID of the recipient snap.
   * @param options - Bag of options to pass to the RPC handler.
   * @returns Promise that can handle the request.
   */
  public async handleRpcRequest(
    snapId: string,
    options: SnapRpcHookArgs,
  ): Promise<unknown> {
    const rpcRequestHandler = this.getRpcRequestHandler(snapId);

    if (!rpcRequestHandler) {
      throw new Error(
        `Snap execution service returned no RPC handler for running snap "${snapId}".`,
      );
    }

    return rpcRequestHandler(options);
  }
}

/**
 * Sets up stream multiplexing for the given stream.
 *
 * @param connectionStream - The stream to mux.
 * @param streamName - The name of the stream, for identification in errors.
 * @returns The multiplexed stream.
 */
export function setupMultiplex(
  connectionStream: Duplex,
  streamName: string,
): ObjectMultiplex {
  const mux = new ObjectMultiplex();
  pipeline(connectionStream, mux, connectionStream, (error) => {
    if (error) {
      streamName
        ? logError(`"${streamName}" stream failure.`, error)
        : logError(error);
    }
  });
  return mux;
}
