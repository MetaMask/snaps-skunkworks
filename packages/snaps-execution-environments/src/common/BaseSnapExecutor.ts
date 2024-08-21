// eslint-disable-next-line @typescript-eslint/triple-slash-reference, spaced-comment
/// <reference path="../../../../node_modules/ses/types.d.ts" />
import { createIdRemapMiddleware } from '@metamask/json-rpc-engine';
import type { RequestArguments } from '@metamask/providers';
import { StreamProvider } from '@metamask/providers/stream-provider';
import { errorCodes, rpcErrors, serializeError } from '@metamask/rpc-errors';
import type { SnapsProvider } from '@metamask/snaps-sdk';
import { getErrorData } from '@metamask/snaps-sdk';
import type {
  SnapExports,
  HandlerType,
  SnapExportsParameters,
} from '@metamask/snaps-utils';
import {
  SNAP_EXPORT_NAMES,
  logError,
  SNAP_EXPORTS,
  WrappedSnapError,
  unwrapError,
  logInfo,
} from '@metamask/snaps-utils';
import { validate, is } from '@metamask/superstruct';
import type {
  JsonRpcNotification,
  JsonRpcId,
  JsonRpcRequest,
  Json,
} from '@metamask/utils';
import {
  assert,
  isJsonRpcRequest,
  hasProperty,
  getSafeJson,
  JsonRpcIdStruct,
} from '@metamask/utils';
import type { Duplex } from 'readable-stream';

import type { CommandMethodsMapping } from './commands';
import { getCommandMethodImplementations } from './commands';
import { createEndowments } from './endowments';
import { addEventListener, removeEventListener } from './globalEvents';
import { sortParamKeys } from './sortParams';
import {
  assertEthereumOutboundRequest,
  assertSnapOutboundRequest,
  sanitizeRequestArguments,
  proxyStreamProvider,
  withTeardown,
  isValidResponse,
} from './utils';
import {
  ExecuteSnapRequestArgumentsStruct,
  PingRequestArgumentsStruct,
  SnapRpcRequestArgumentsStruct,
  TerminateRequestArgumentsStruct,
} from './validation';
import { log } from '../logging';

type EvaluationData = {
  stop: () => void;
};

type SnapData = {
  exports: SnapExports;
  runningEvaluations: Set<EvaluationData>;
  idleTeardown: () => Promise<void>;
};

const fallbackError = {
  code: errorCodes.rpc.internal,
  message: 'Execution Environment Error',
};

const unhandledError = rpcErrors
  .internal<Json>({
    message: 'Unhandled Snap Error',
  })
  .serialize();

export type InvokeSnapArgs = Omit<SnapExportsParameters[0], 'chainId'>;

export type InvokeSnap = (
  target: string,
  handler: HandlerType,
  args: InvokeSnapArgs | undefined,
) => Promise<Json>;

/**
 * The supported methods in the execution environment. The validator checks the
 * incoming JSON-RPC request, and the `params` property is used for sorting the
 * parameters, if they are an object.
 */
const EXECUTION_ENVIRONMENT_METHODS = {
  ping: {
    struct: PingRequestArgumentsStruct,
    params: [],
  },
  executeSnap: {
    struct: ExecuteSnapRequestArgumentsStruct,
    params: ['snapId', 'sourceCode', 'endowments'],
  },
  terminate: {
    struct: TerminateRequestArgumentsStruct,
    params: [],
  },
  snapRpc: {
    struct: SnapRpcRequestArgumentsStruct,
    params: ['target', 'handler', 'origin', 'request'],
  },
};

type Methods = typeof EXECUTION_ENVIRONMENT_METHODS;

export type NotifyFunction = (
  notification: Omit<JsonRpcNotification, 'jsonrpc'>,
) => Promise<void>;

export class BaseSnapExecutor {
  private readonly snapData: Map<string, SnapData>;

  private readonly commandStream: Duplex;

  private readonly rpcStream: Duplex;

  private readonly methods: CommandMethodsMapping;

  private snapErrorHandler?: (event: ErrorEvent) => void;

  private snapPromiseErrorHandler?: (event: PromiseRejectionEvent) => void;

  private lastTeardown = 0;

  protected constructor(commandStream: Duplex, rpcStream: Duplex) {
    this.snapData = new Map();
    this.commandStream = commandStream;
    this.commandStream.on('data', (data) => {
      this.onCommandRequest(data).catch((error) => {
        // TODO: Decide how to handle errors.
        logError(error);
      });
    });
    this.rpcStream = rpcStream;

    this.methods = getCommandMethodImplementations(
      this.startSnap.bind(this),
      async (target, handlerType, args) => {
        const data = this.snapData.get(target);
        // We're capturing the handler in case someone modifies the data object
        // before the call.
        const handler = data?.exports[handlerType];
        const { required } = SNAP_EXPORTS[handlerType];

        assert(
          !required || handler !== undefined,
          `No ${handlerType} handler exported for snap "${target}`,
          rpcErrors.methodNotSupported,
        );

        // Certain handlers are not required. If they are not exported, we
        // return null.
        if (!handler) {
          return null;
        }

        let result = await this.executeInSnapContext(target, () =>
          // TODO: fix handler args type cast
          handler(args as any),
        );

        // The handler might not return anything, but undefined is not valid JSON.
        if (result === undefined) {
          result = null;
        }

        // /!\ Always return only sanitized JSON to prevent security flaws. /!\
        try {
          return getSafeJson(result);
        } catch (error) {
          throw rpcErrors.internal(
            `Received non-JSON-serializable value: ${error.message.replace(
              /^Assertion failed: /u,
              '',
            )}`,
          );
        }
      },
      this.onTerminate.bind(this),
    );
  }

  private errorHandler(error: unknown, data: Record<string, Json>) {
    const serializedError = serializeError(error, {
      fallbackError: unhandledError,
      shouldIncludeStack: false,
    });

    const errorData = getErrorData(serializedError);

    this.#notify({
      method: 'UnhandledError',
      params: {
        error: {
          ...serializedError,
          data: {
            ...errorData,
            ...data,
          },
        },
      },
    }).catch((notifyError) => {
      logError(notifyError);
    });
  }

  private async onCommandRequest(message: JsonRpcRequest) {
    if (!isJsonRpcRequest(message)) {
      if (
        hasProperty(message, 'id') &&
        is((message as Pick<JsonRpcRequest, 'id'>).id, JsonRpcIdStruct)
      ) {
        // Instead of throwing, we directly respond with an error.
        // We can only do this if the message ID is still valid.
        await this.#write({
          error: serializeError(
            rpcErrors.internal(
              'JSON-RPC requests must be JSON serializable objects.',
            ),
          ),
          id: (message as Pick<JsonRpcRequest, 'id'>).id,
          jsonrpc: '2.0',
        });
      } else {
        logInfo(
          'Command stream received a non-JSON-RPC request, and was unable to respond.',
        );
      }
      return;
    }

    const { id, method, params } = message;

    if (!hasProperty(EXECUTION_ENVIRONMENT_METHODS, method)) {
      await this.#respond(id, {
        error: rpcErrors
          .methodNotFound({
            data: {
              method,
            },
          })
          .serialize(),
      });
      return;
    }

    const methodObject = EXECUTION_ENVIRONMENT_METHODS[method as keyof Methods];

    // support params by-name and by-position
    const paramsAsArray = sortParamKeys(methodObject.params, params);

    const [error] = validate<any, any>(paramsAsArray, methodObject.struct);
    if (error) {
      await this.#respond(id, {
        error: rpcErrors
          .invalidParams({
            message: `Invalid parameters for method "${method}": ${error.message}.`,
            data: {
              method,
              params: paramsAsArray,
            },
          })
          .serialize(),
      });
      return;
    }

    try {
      const result = await (this.methods as any)[method](...paramsAsArray);
      await this.#respond(id, { result });
    } catch (rpcError) {
      await this.#respond(id, {
        error: serializeError(rpcError, {
          fallbackError,
        }),
      });
    }
  }

  // Awaitable function that writes back to the command stream
  // To prevent snap execution from blocking writing we wrap in a promise
  // and await it before continuing execution
  async #write(chunk: Json) {
    return new Promise<void>((resolve, reject) => {
      this.commandStream.write(chunk, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  async #notify(notification: Omit<JsonRpcNotification, 'jsonrpc'>) {
    if (!isValidResponse(notification)) {
      throw rpcErrors.internal(
        'JSON-RPC notifications must be JSON serializable objects smaller than 64 MB.',
      );
    }

    await this.#write({
      ...notification,
      jsonrpc: '2.0',
    });
  }

  async #respond(id: JsonRpcId, response: Record<string, unknown>) {
    if (!isValidResponse(response)) {
      // Instead of throwing, we directly respond with an error.
      // This prevents an issue where we wouldn't respond when errors were non-serializable
      await this.#write({
        error: serializeError(
          rpcErrors.internal(
            'JSON-RPC responses must be JSON serializable objects smaller than 64 MB.',
          ),
        ),
        id,
        jsonrpc: '2.0',
      });
      return;
    }

    await this.#write({
      ...response,
      id,
      jsonrpc: '2.0',
    });
  }

  /**
   * Attempts to evaluate a snap in SES. Generates APIs for the snap. May throw
   * on errors.
   *
   * @param snapId - The id of the snap.
   * @param sourceCode - The source code of the snap, in IIFE format.
   * @param _endowments - An array of the names of the endowments.
   */
  protected async startSnap(
    snapId: string,
    sourceCode: string,
    _endowments: string[],
  ): Promise<void> {
    log(`Starting snap '${snapId}' in worker.`);
    if (this.snapPromiseErrorHandler) {
      removeEventListener('unhandledrejection', this.snapPromiseErrorHandler);
    }

    if (this.snapErrorHandler) {
      removeEventListener('error', this.snapErrorHandler);
    }

    this.snapErrorHandler = (error: ErrorEvent) => {
      this.errorHandler(error.error, { snapId });
    };

    this.snapPromiseErrorHandler = (error: PromiseRejectionEvent) => {
      this.errorHandler(error instanceof Error ? error : error.reason, {
        snapId,
      });
    };

    const provider = new StreamProvider(this.rpcStream, {
      jsonRpcStreamName: 'metamask-provider',
      rpcMiddleware: [createIdRemapMiddleware()],
    });

    await provider.initialize();

    const snap = this.createSnapGlobal(provider);
    const ethereum = this.createEIP1193Provider(provider);
    // We specifically use any type because the Snap can modify the object any way they want
    const snapModule: any = { exports: {} };

    try {
      const { endowments, teardown: endowmentTeardown } = createEndowments({
        snap,
        ethereum,
        snapId,
        endowments: _endowments,
        notify: this.#notify.bind(this),
      });

      // !!! Ensure that this is the only place the data is being set.
      // Other methods access the object value and mutate its properties.
      this.snapData.set(snapId, {
        idleTeardown: endowmentTeardown,
        runningEvaluations: new Set(),
        exports: {},
      });

      addEventListener('unhandledRejection', this.snapPromiseErrorHandler);
      addEventListener('error', this.snapErrorHandler);

      const compartment = new Compartment({
        ...endowments,
        module: snapModule,
        exports: snapModule.exports,
      });

      // All of those are JavaScript runtime specific and self referential,
      // but we add them for compatibility sake with external libraries.
      //
      // We can't do that in the injected globals object above
      // because SES creates its own globalThis
      compartment.globalThis.self = compartment.globalThis;
      compartment.globalThis.global = compartment.globalThis;
      compartment.globalThis.window = compartment.globalThis;

      await this.executeInSnapContext(snapId, () => {
        compartment.evaluate(sourceCode);
        this.registerSnapExports(snapId, snapModule);
      });
    } catch (error) {
      this.removeSnap(snapId);

      const [cause] = unwrapError(error);
      throw rpcErrors.internal({
        message: `Error while running snap '${snapId}': ${cause.message}`,
        data: {
          cause: cause.serialize(),
        },
      });
    }
  }

  /**
   * Cancels all running evaluations of all snaps and clears all snap data.
   * NOTE:** Should only be called in response to the `terminate` RPC command.
   */
  protected onTerminate() {
    // `stop()` tears down snap endowments.
    // Teardown will also be run for each snap as soon as there are
    // no more running evaluations for that snap.
    this.snapData.forEach((data) =>
      data.runningEvaluations.forEach((evaluation) => evaluation.stop()),
    );
    this.snapData.clear();
  }

  private registerSnapExports(snapId: string, snapModule: any) {
    const data = this.snapData.get(snapId);
    // Somebody deleted the snap before we could register.
    if (!data) {
      return;
    }

    data.exports = SNAP_EXPORT_NAMES.reduce((acc, exportName) => {
      const snapExport = snapModule.exports[exportName];
      const { validator } = SNAP_EXPORTS[exportName];
      if (validator(snapExport)) {
        return { ...acc, [exportName]: snapExport };
      }
      return acc;
    }, {});

    // If the Snap has no valid exports after this, fail.
    assert(Object.keys(data.exports).length > 0, 'Snap has no valid exports.');
  }

  /**
   * Instantiates a snap API object (i.e. `globalThis.snap`).
   *
   * @param provider - A StreamProvider connected to MetaMask.
   * @returns The snap provider object.
   */
  private createSnapGlobal(provider: StreamProvider): SnapsProvider {
    const originalRequest = provider.request.bind(provider);

    const request = async (args: RequestArguments) => {
      const sanitizedArgs = sanitizeRequestArguments(args);
      assertSnapOutboundRequest(sanitizedArgs);
      return await withTeardown(
        (async () => {
          await this.#notify({
            method: 'OutboundRequest',
            params: { source: 'snap.request' },
          });
          try {
            return await originalRequest(sanitizedArgs);
          } finally {
            await this.#notify({
              method: 'OutboundResponse',
              params: { source: 'snap.request' },
            });
          }
        })(),
        this as any,
      );
    };

    const snapGlobalProxy = proxyStreamProvider(request) as SnapsProvider;

    return harden(snapGlobalProxy);
  }

  /**
   * Instantiates an EIP-1193 Ethereum provider object (i.e. `globalThis.ethereum`).
   *
   * @param provider - A StreamProvider connected to MetaMask.
   * @returns The EIP-1193 Ethereum provider object.
   */
  private createEIP1193Provider(provider: StreamProvider): StreamProvider {
    const originalRequest = provider.request.bind(provider);

    const request = async (args: RequestArguments) => {
      const sanitizedArgs = sanitizeRequestArguments(args);
      assertEthereumOutboundRequest(sanitizedArgs);
      return await withTeardown(
        (async () => {
          await this.#notify({
            method: 'OutboundRequest',
            params: { source: 'ethereum.request' },
          });
          try {
            return await originalRequest(sanitizedArgs);
          } finally {
            await this.#notify({
              method: 'OutboundResponse',
              params: { source: 'ethereum.request' },
            });
          }
        })(),
        this as any,
      );
    };

    const streamProviderProxy = proxyStreamProvider(request);

    return harden(streamProviderProxy);
  }

  /**
   * Removes the snap with the given name.
   *
   * @param snapId - The id of the snap to remove.
   */
  private removeSnap(snapId: string): void {
    this.snapData.delete(snapId);
  }

  /**
   * Calls the specified executor function in the context of the specified snap.
   * Essentially, this means that the operation performed by the executor is
   * counted as an evaluation of the specified snap. When the count of running
   * evaluations of a snap reaches zero, its endowments are torn down.
   *
   * @param snapId - The id of the snap whose context to execute in.
   * @param executor - The function that will be executed in the snap's context.
   * @returns The executor's return value.
   * @template Result - The return value of the executor.
   */
  private async executeInSnapContext<Result>(
    snapId: string,
    executor: () => Promise<Result> | Result,
  ): Promise<Result> {
    const data = this.snapData.get(snapId);
    if (data === undefined) {
      throw rpcErrors.internal(
        `Tried to execute in context of unknown snap: "${snapId}".`,
      );
    }

    let stop: () => void;
    const stopPromise = new Promise<never>(
      (_, reject) =>
        (stop = () =>
          reject(
            // TODO(rekmarks): Specify / standardize error code for this case.
            rpcErrors.internal(
              `The snap "${snapId}" has been terminated during execution.`,
            ),
          )),
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const evaluationData = { stop: stop! };

    try {
      data.runningEvaluations.add(evaluationData);
      // Notice that we have to await this executor.
      // If we didn't, we would decrease the amount of running evaluations
      // before the promise actually resolves
      return await Promise.race([executor(), stopPromise]);
    } catch (error) {
      throw new WrappedSnapError(error);
    } finally {
      data.runningEvaluations.delete(evaluationData);

      if (data.runningEvaluations.size === 0) {
        this.lastTeardown += 1;
        await data.idleTeardown();
      }
    }
  }
}
