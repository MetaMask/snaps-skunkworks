import { BasePostMessageStream } from '@metamask/post-message-stream';
import { JsonRpcRequest } from '@metamask/utils';

export type WebWorkerPostMessageStreamArgs = {
  stream: BasePostMessageStream;
  jobId: string;
};

export type WebWorkerPostMessage = {
  jobId: string;
  data: JsonRpcRequest;
};

/**
 * A post message stream that wraps messages in a job ID, before sending them
 * over the underlying stream.
 */
export class WebWorkerPostMessageStream extends BasePostMessageStream {
  readonly #stream: BasePostMessageStream;

  readonly #jobId: string;

  /**
   * Initializes a new `WebWorkerPostMessageStream` instance.
   *
   * @param args - The constructor arguments.
   * @param args.stream - The underlying stream to use for communication.
   * @param args.jobId - The ID of the job this stream is associated with.
   */
  constructor({ stream, jobId }: WebWorkerPostMessageStreamArgs) {
    super();

    this.#stream = stream;
    this.#jobId = jobId;

    this.#stream.on('data', this.#onData.bind(this));
  }

  /**
   * Handle incoming data from the underlying stream. This checks that the job
   * ID matches the expected job ID, and pushes the data to the stream if so.
   *
   * @param data - The data to handle.
   */
  #onData(data: WebWorkerPostMessage) {
    if (data.jobId !== this.#jobId) {
      return;
    }

    this.push(data.data);
  }

  /**
   * Write data to the underlying stream. This wraps the data in an object with
   * the job ID.
   *
   * @param data - The data to write.
   */
  _postMessage(data: WebWorkerPostMessage) {
    this.#stream.write({
      jobId: this.#jobId,
      data,
    });
  }
}
