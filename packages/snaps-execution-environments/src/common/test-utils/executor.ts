import type { Json, JsonRpcRequest, JsonRpcResponse } from '@metamask/utils';
import type { DuplexOptions, Readable } from 'readable-stream';
import { Duplex } from 'readable-stream';

import { BaseSnapExecutor } from '../BaseSnapExecutor';

export type TwoWayPassThroughBuffer = {
  buffer: { chunk: any; encoding: BufferEncoding }[];
  canPush: boolean;
};

export class TwoWayPassThrough {
  static #flush(bufferData: TwoWayPassThroughBuffer, stream: Readable) {
    while (bufferData.canPush && bufferData.buffer.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { chunk: data, encoding: enc } = bufferData.buffer.shift()!;
      bufferData.canPush = stream.push(data, enc);
    }
  }

  readonly left: Duplex;

  readonly right: Duplex;

  readonly #leftToRight: TwoWayPassThroughBuffer = {
    buffer: [],
    canPush: false,
  };

  readonly #rightToLeft: TwoWayPassThroughBuffer = {
    buffer: [],
    canPush: false,
  };

  constructor(opts?: DuplexOptions) {
    this.left = new Duplex({
      ...opts,
      write: (chunk, encoding, callback) => {
        this.#leftToRight.buffer.push({ chunk, encoding });
        TwoWayPassThrough.#flush(this.#leftToRight, this.right);
        return callback();
      },
      read: () => {
        this.#rightToLeft.canPush = true;
        TwoWayPassThrough.#flush(this.#rightToLeft, this.left);
      },
    });

    this.right = new Duplex({
      ...opts,
      write: (chunk, encoding, callback) => {
        this.#rightToLeft.buffer.push({ chunk, encoding });
        TwoWayPassThrough.#flush(this.#rightToLeft, this.left);
        return callback();
      },
      read: () => {
        this.#leftToRight.canPush = true;
        TwoWayPassThrough.#flush(this.#leftToRight, this.right);
      },
    });
  }
}

export class TestSnapExecutor extends BaseSnapExecutor {
  readonly #commandLeft: Duplex;

  readonly #rpcLeft: Duplex;

  readonly #commandBuffer: any[] = [];

  readonly #rpcBuffer: any[] = [];

  readonly #commandListeners: ((chunk: any) => void)[] = [];

  readonly #rpcListeners: ((chunk: any) => void)[] = [];

  constructor() {
    const rpc = new TwoWayPassThrough({
      objectMode: true,
      allowHalfOpen: false,
    });
    const command = new TwoWayPassThrough({
      objectMode: true,
      allowHalfOpen: false,
    });

    super(command.right, rpc.right);

    this.#commandLeft = command.left;
    this.#rpcLeft = rpc.left;

    this.#commandLeft.on('data', (chunk) => {
      this.#commandBuffer.push(chunk);
      TestSnapExecutor.#flushReads(this.#commandBuffer, this.#commandListeners);
    });

    this.#rpcLeft.on('data', (chunk) => {
      this.#rpcBuffer.push(chunk);
      TestSnapExecutor.#flushReads(this.#rpcBuffer, this.#rpcListeners);
    });
  }

  get commandBuffer() {
    return this.#commandBuffer;
  }

  // Utility function for executing snaps
  public async executeSnap(
    id: number,
    name: string,
    code: string,
    endowments: string[],
  ) {
    const providerRequestPromise = this.readRpc();
    await this.writeCommand({
      jsonrpc: '2.0',
      id,
      method: 'executeSnap',
      params: [name, code, endowments],
    });

    // In case we are running fake timers, execute a tiny step that forces
    // `setTimeout` to execute, is required for stream communication.
    if ('clock' in setTimeout) {
      jest.advanceTimersByTime(1);
    }

    const providerRequest = await providerRequestPromise;
    await this.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: providerRequest.data.id!,
        result: {
          isUnlocked: false,
          accounts: [],
          chainId: '0x1',
          networkVersion: '1',
        },
      },
    });

    if ('clock' in setTimeout) {
      jest.advanceTimersByTime(1);
    }
  }

  public async writeCommand(message: JsonRpcRequest): Promise<void> {
    return new Promise((resolve, reject) =>
      this.#commandLeft.write(message, (error) => {
        if (error) {
          return reject(error);
        }
        return resolve();
      }),
    );
  }

  public async readCommand(): Promise<JsonRpcRequest> {
    const promise = new Promise<JsonRpcRequest>((resolve) =>
      this.#commandListeners.push(resolve),
    );

    TestSnapExecutor.#flushReads(this.#commandBuffer, this.#commandListeners);

    return promise;
  }

  static #flushReads(readBuffer: any[], listeners: ((chunk: any) => void)[]) {
    while (readBuffer.length && listeners.length) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const chunk = readBuffer.shift()!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      listeners.shift()!(chunk);
    }
  }

  public async writeRpc(message: {
    name: string;
    data: JsonRpcResponse<Json>;
  }): Promise<void> {
    return new Promise((resolve, reject) =>
      this.#rpcLeft.write(message, (error) => {
        if (error) {
          return reject(error);
        }
        return resolve();
      }),
    );
  }

  public async readRpc(): Promise<{
    name: string;
    data: JsonRpcRequest;
  }> {
    const promise = new Promise<{
      name: string;
      data: JsonRpcRequest;
    }>((resolve) => this.#rpcListeners.push(resolve));

    TestSnapExecutor.#flushReads(this.#rpcBuffer, this.#rpcListeners);

    return promise;
  }
}
