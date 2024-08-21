import type { BasePostMessageStream } from '@metamask/post-message-stream';
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import { createWindow } from '@metamask/snaps-utils';
import { assert } from '@metamask/utils';
import { nanoid } from 'nanoid';

import type {
  ExecutionServiceArgs,
  TerminateJobArgs,
} from '../AbstractExecutionService';
import { AbstractExecutionService } from '../AbstractExecutionService';
import { ProxyPostMessageStream } from '../ProxyPostMessageStream';

type WebWorkerExecutionEnvironmentServiceArgs = {
  documentUrl: URL;
} & ExecutionServiceArgs;

export const WORKER_POOL_ID = 'snaps-worker-pool';

export class WebWorkerExecutionService extends AbstractExecutionService<string> {
  readonly #documentUrl: URL;

  #runtimeStream?: BasePostMessageStream;

  /**
   * Create a new webworker execution service.
   *
   * @param args - The constructor arguments.
   * @param args.documentUrl - The URL of the worker pool document to use as the
   * execution environment.
   * @param args.messenger - The messenger to use for communication with the
   * `SnapController`.
   * @param args.setupSnapProvider - The function to use to set up the snap
   * provider.
   */
  constructor({
    documentUrl,
    messenger,
    setupSnapProvider,
  }: WebWorkerExecutionEnvironmentServiceArgs) {
    super({
      messenger,
      setupSnapProvider,
    });

    this.#documentUrl = documentUrl;
  }

  /**
   * Send a termination command to the worker pool document.
   *
   * @param job - The job to terminate.
   */
  protected async terminateJob(job: TerminateJobArgs<string>) {
    // The `AbstractExecutionService` will have already closed the job stream,
    // so we write to the runtime stream directly.
    assert(this.#runtimeStream, 'Runtime stream not initialized.');
    this.#runtimeStream.write({
      jobId: job.id,
      data: {
        jsonrpc: '2.0',
        method: 'terminateJob',
        id: nanoid(),
      },
    });
  }

  /**
   * Create a new stream for the specified job. This wraps the runtime stream
   * in a stream specific to the job.
   *
   * @param jobId - The job ID.
   * @returns An object with the job ID and stream.
   */
  protected async initEnvStream(jobId: string) {
    // Lazily create the worker pool document.
    await this.createDocument();

    // `createDocument` should have initialized the runtime stream.
    assert(this.#runtimeStream, 'Runtime stream not initialized.');

    const stream = new ProxyPostMessageStream({
      stream: this.#runtimeStream,
      jobId,
    });

    return { worker: jobId, stream };
  }

  /**
   * Creates the worker pool document to be used as the execution environment.
   *
   * If the document already exists, this does nothing.
   */
  private async createDocument() {
    // We only want to create a single pool.
    if (document.getElementById(WORKER_POOL_ID)) {
      return;
    }

    const window = await createWindow(
      this.#documentUrl.href,
      WORKER_POOL_ID,
      false,
    );

    this.#runtimeStream = new WindowPostMessageStream({
      name: 'parent',
      target: 'child',
      targetWindow: window,
      targetOrigin: '*',
    });
  }
}
