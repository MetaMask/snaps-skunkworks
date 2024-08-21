import { assert } from '@metamask/utils';

import type { EndowmentFactoryOptions } from './commonEndowmentFactory';
import { withTeardown } from '../utils';

/**
 * This class wraps a Response object.
 * That way, a teardown process can stop any processes left.
 */
class ResponseWrapper implements Response {
  readonly #teardownRef: { lastTeardown: number };

  readonly #ogResponse: Response;

  readonly #onStart: () => Promise<void>;

  readonly #onFinish: () => Promise<void>;

  constructor(
    ogResponse: Response,
    teardownRef: { lastTeardown: number },
    onStart: () => Promise<void>,
    onFinish: () => Promise<void>,
  ) {
    this.#ogResponse = ogResponse;
    this.#teardownRef = teardownRef;
    this.#onStart = onStart;
    this.#onFinish = onFinish;
  }

  get body(): ReadableStream<Uint8Array> | null {
    return this.#ogResponse.body;
  }

  get bodyUsed() {
    return this.#ogResponse.bodyUsed;
  }

  get headers() {
    return this.#ogResponse.headers;
  }

  get ok() {
    return this.#ogResponse.ok;
  }

  get redirected() {
    return this.#ogResponse.redirected;
  }

  get status() {
    return this.#ogResponse.status;
  }

  get statusText() {
    return this.#ogResponse.statusText;
  }

  get type() {
    return this.#ogResponse.type;
  }

  get url() {
    return this.#ogResponse.url;
  }

  async text() {
    return await withTeardown<string>(
      (async () => {
        await this.#onStart();
        try {
          return await this.#ogResponse.text();
        } finally {
          await this.#onFinish();
        }
      })(),
      this.#teardownRef,
    );
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return await withTeardown<ArrayBuffer>(
      (async () => {
        await this.#onStart();
        try {
          return await this.#ogResponse.arrayBuffer();
        } finally {
          await this.#onFinish();
        }
      })(),
      this.#teardownRef,
    );
  }

  async blob(): Promise<Blob> {
    return await withTeardown<Blob>(
      (async () => {
        await this.#onStart();
        try {
          return await this.#ogResponse.blob();
        } finally {
          await this.#onFinish();
        }
      })(),
      this.#teardownRef,
    );
  }

  clone(): Response {
    const newResponse = this.#ogResponse.clone();
    return new ResponseWrapper(
      newResponse,
      this.#teardownRef,
      this.#onStart,
      this.#onFinish,
    );
  }

  async formData(): Promise<FormData> {
    return await withTeardown<FormData>(
      (async () => {
        await this.#onStart();
        try {
          return await this.#ogResponse.formData();
        } finally {
          await this.#onFinish();
        }
      })(),
      this.#teardownRef,
    );
  }

  async json(): Promise<any> {
    return await withTeardown(
      (async () => {
        await this.#onStart();
        try {
          return await this.#ogResponse.json();
        } finally {
          await this.#onFinish();
        }
      })(),
      this.#teardownRef,
    );
  }
}

/**
 * Create a network endowment, consisting of a `fetch` function.
 * This allows us to provide a teardown function, so that we can cancel
 * any pending requests, connections, streams, etc. that may be open when a snap
 * is terminated.
 *
 * This wraps the original implementation of `fetch`,
 * to ensure that a bad actor cannot get access to the original function, thus
 * potentially preventing the network requests from being torn down.
 *
 * @param options - An options bag.
 * @param options.notify - A reference to the notify function of the snap executor.
 * @returns An object containing a wrapped `fetch`
 * function, as well as a teardown function.
 */
const createNetwork = ({ notify }: EndowmentFactoryOptions = {}) => {
  assert(notify, 'Notify must be passed to network endowment factory');
  // Open fetch calls or open body streams
  const openConnections = new Set<{ cancel: () => Promise<void> }>();
  // Track last teardown count
  const teardownRef = { lastTeardown: 0 };

  // Remove items from openConnections after they were garbage collected
  const cleanup = new FinalizationRegistry<() => void>(
    /* istanbul ignore next: can't test garbage collection without modifying node parameters */
    (callback) => callback(),
  );

  const _fetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const abortController = new AbortController();
    if (init?.signal !== null && init?.signal !== undefined) {
      const originalSignal = init.signal;
      // Merge abort controllers
      originalSignal.addEventListener(
        'abort',
        () => {
          abortController.abort((originalSignal as any).reason);
        },
        { once: true },
      );
    }

    let started = false;
    const onStart = async () => {
      if (!started) {
        started = true;
        await notify({
          method: 'OutboundRequest',
          params: { source: 'fetch' },
        });
      }
    };

    let finished = false;
    const onFinish = async () => {
      if (!finished) {
        finished = true;
        await notify({
          method: 'OutboundResponse',
          params: { source: 'fetch' },
        });
      }
    };

    let res: Response;
    let openFetchConnection: { cancel: () => Promise<void> } | undefined;
    return await withTeardown(
      (async () => {
        try {
          await notify({
            method: 'OutboundRequest',
            params: { source: 'fetch' },
          });
          const fetchPromise = fetch(input, {
            ...init,
            signal: abortController.signal,
          });

          openFetchConnection = {
            cancel: async () => {
              abortController.abort();
              try {
                await fetchPromise;
              } catch {
                /* do nothing */
              }
            },
          };
          openConnections.add(openFetchConnection);

          res = new ResponseWrapper(
            await fetchPromise,
            teardownRef,
            onStart,
            onFinish,
          );
        } finally {
          if (openFetchConnection !== undefined) {
            openConnections.delete(openFetchConnection);
          }
          await notify({
            method: 'OutboundResponse',
            params: { source: 'fetch' },
          });
        }

        if (res.body !== null) {
          const body = new WeakRef<ReadableStream>(res.body);

          const openBodyConnection = {
            cancel:
              /* istanbul ignore next: see it.todo('can be torn down during body read') test */
              async () => {
                try {
                  await body.deref()?.cancel();
                } catch {
                  /* do nothing */
                }
              },
          };
          openConnections.add(openBodyConnection);
          cleanup.register(
            res.body,
            /* istanbul ignore next: can't test garbage collection without modifying node parameters */
            () => openConnections.delete(openBodyConnection),
          );
        }
        return harden(res);
      })(),
      teardownRef,
    );
  };

  const teardownFunction = async () => {
    teardownRef.lastTeardown += 1;
    const promises: Promise<void>[] = [];
    openConnections.forEach(({ cancel }) => promises.push(cancel()));
    openConnections.clear();
    await Promise.all(promises);
  };

  return {
    fetch: harden(_fetch),
    // Request, Headers and Response are the endowments injected alongside fetch
    // only when 'endowment:network-access' permission is requested,
    // therefore these are hardened as part of fetch dependency injection within its factory.
    // These endowments are not (and should never be) available by default.
    Request: harden(Request),
    Headers: harden(Headers),
    Response: harden(Response),
    teardownFunction,
  };
};

const endowmentModule = {
  names: ['fetch', 'Request', 'Headers', 'Response'] as const,
  factory: createNetwork,
};
export default endowmentModule;
