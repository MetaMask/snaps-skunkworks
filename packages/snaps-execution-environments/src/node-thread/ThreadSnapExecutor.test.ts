// eslint-disable-next-line import-x/no-unassigned-import
import 'ses';
import { SNAP_STREAM_NAMES, HandlerType } from '@metamask/snaps-utils';
import type { Json, JsonRpcRequest, JsonRpcSuccess } from '@metamask/utils';
import { EventEmitter } from 'stream';
import { parentPort } from 'worker_threads';

import { ThreadSnapExecutor } from './ThreadSnapExecutor';

const FAKE_ORIGIN = 'origin:foo';
const FAKE_SNAP_NAME = 'local:foo';
const ON_RPC_REQUEST = HandlerType.OnRpcRequest;

jest.mock('worker_threads', () => ({
  parentPort: {
    on: jest.fn(),
    postMessage: jest.fn(),
    removeListener: jest.fn(),
  },
}));

describe('ThreadSnapExecutor', () => {
  it('receives and processes commands', async () => {
    const parentEmitter = new EventEmitter();
    const childEmitter = new EventEmitter();

    const onSpy = jest
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .spyOn(parentPort!, 'on')
      .mockImplementation(
        (event, listener) => parentEmitter.on(event, listener) as any,
      );
    const sendSpy = jest
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .spyOn(parentPort!, 'postMessage')
      .mockImplementation((message) => childEmitter.emit('message', message));

    // Initialize
    ThreadSnapExecutor.initialize();
    expect(onSpy).toHaveBeenCalled();

    const CODE = `
        exports.onRpcRequest = (() => {
          return 'foobar';
        });
      `;

    // Utility functions
    const emit = (data: Json) => parentEmitter.emit('message', { data });
    const emitChunk = (name: string, data: Json) => emit({ name, data });
    const waitForOutbound = (request: Partial<JsonRpcRequest<any>>): any =>
      new Promise((resolve) => {
        childEmitter.on('message', ({ data: { name, data } }) => {
          if (
            name === SNAP_STREAM_NAMES.JSON_RPC &&
            data.name === 'metamask-provider' &&
            data.data.method === request.method
          ) {
            resolve(data.data);
          }
        });
      });

    const waitForResponse = async (response: JsonRpcSuccess<string>) =>
      new Promise((resolve) => {
        childEmitter.on('message', ({ data }) => {
          if (
            data.data.id === response.id &&
            data.data.result === response.result
          ) {
            resolve(response);
          }
        });
      });

    // Handshake
    expect(sendSpy).toHaveBeenNthCalledWith(1, { data: 'SYN' });
    emit('ACK');
    expect(sendSpy).toHaveBeenNthCalledWith(2, { data: 'ACK' });

    // Execute Snap
    emitChunk(SNAP_STREAM_NAMES.COMMAND, {
      jsonrpc: '2.0',
      id: 1,
      method: 'executeSnap',
      params: [FAKE_SNAP_NAME, CODE, []],
    });

    const providerRequest = await waitForOutbound({
      method: 'metamask_getProviderState',
    });

    emitChunk(SNAP_STREAM_NAMES.JSON_RPC, {
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        id: providerRequest.id,
        result: {
          isUnlocked: false,
          accounts: [],
          chainId: '0x1',
          networkVersion: '1',
        },
      },
    });

    expect(
      await waitForResponse({ result: 'OK', id: 1, jsonrpc: '2.0' }),
    ).not.toBeNull();

    // Process Snap RPC request
    emitChunk(SNAP_STREAM_NAMES.COMMAND, {
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        FAKE_SNAP_NAME,
        ON_RPC_REQUEST,
        FAKE_ORIGIN,
        { jsonrpc: '2.0', method: '' },
      ],
    });

    expect(
      await waitForResponse({ result: 'foobar', id: 2, jsonrpc: '2.0' }),
    ).not.toBeNull();
  });
});
