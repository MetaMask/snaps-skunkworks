/* eslint-disable @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-shadow, import/no-unassigned-import */

import { UserInputEventType } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import {
  MOCK_ORIGIN,
  MOCK_SNAP_ID,
  spy,
  sleep,
} from '@metamask/snaps-utils/test-utils';
import { assertIsJsonRpcSuccess, isPlainObject } from '@metamask/utils';

import {
  getMockedStreamProvider,
  walkAndSearch,
} from './test-utils/endowments';
import { TestSnapExecutor } from './test-utils/executor';
import { testEndowmentHardening } from './test-utils/hardening';

import 'ses';

describe('BaseSnapExecutor', () => {
  before(() => {
    // @ts-expect-error - `globalThis.process` is not optional.
    delete globalThis.process;

    globalThis.harden = (value) => value;
  });

  const TIMER_ENDOWMENTS = [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'console',
  ];

  describe('timers', () => {
    it("doesn't leak execution outside of expected timeshare during initial eval", async () => {
      const CODE = `
        setTimeout(() => { throw new Error('setTimeout executed'); }, 10);
        setInterval(() => { throw new Error('setInterval executed'); }, 10);

        exports.onRpcRequest = () => null;
      `;

      const executor = new TestSnapExecutor();
      await executor.executeSnap(1, MOCK_SNAP_ID, CODE, TIMER_ENDOWMENTS);

      await sleep(20);

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'OK',
      });

      // If this is empty, it means that the errors aren't being thrown.
      expect(executor.commandBuffer).toHaveLength(0);
    });

    it("doesn't leak execution outside of expected timeshare during RPC calls", async () => {
      // The 25 timeout should run and return a value, but all later timeouts
      // should fail to execute.
      const CODE = `
        exports.onRpcRequest = (() => {
          let resolve;
          const promise = new Promise((r) => { resolve = r; });

          setTimeout(() => resolve('SNAP OK'), 25);
          setTimeout(() => { throw new Error('setTimeout executed'); }, 50);
          setInterval(() => { throw new Error('setInterval executed'); }, 50);

          return promise;
        });
      `;

      const executor = new TestSnapExecutor();
      await executor.executeSnap(1, MOCK_SNAP_ID, CODE, TIMER_ENDOWMENTS);

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'OK',
      });

      await executor.writeCommand({
        jsonrpc: '2.0',
        id: 2,
        method: 'snapRpc',
        params: [
          MOCK_SNAP_ID,
          HandlerType.OnRpcRequest,
          MOCK_ORIGIN,
          { jsonrpc: '2.0', method: '' },
        ],
      });

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 2,
        result: 'SNAP OK',
      });

      await sleep(100);

      // If this is empty, it means that the errors aren't being thrown.
      expect(executor.commandBuffer).toHaveLength(0);
    });
  });

  it('terminates a request when terminate RPC is called', async () => {
    const CODE = `
      exports.onRpcRequest = (() => new Promise(() => ({})));
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 3,
      method: 'terminate',
      params: [],
    });

    // TODO(ritave): Make the test not depend on the return order of id 2 and 3
    expect(await executor.readCommand()).toStrictEqual({
      id: 3,
      jsonrpc: '2.0',
      result: 'OK',
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32603,
            message: `The snap "${MOCK_SNAP_ID}" has been terminated during execution.`,
          }),
        },
      },
    });
  });

  it('reports when outbound requests are made using ethereum', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => ethereum.request({ method: 'eth_blockNumber', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const blockNumRequest = await executor.readRpc();
    expect(blockNumRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      },
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: blockNumRequest.data.id!,
        result: '0xa70e77',
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: '0xa70e77',
    });
  });

  it('reports when outbound requests are made using snap API', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => snap.request({ method: 'wallet_getPermissions', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'snap.request' },
    });

    const walletRequest = await executor.readRpc();
    expect(walletRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'wallet_getPermissions',
        params: [],
      },
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: walletRequest.data.id!,
        result: [],
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'snap.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: [],
    });
  });

  it("doesn't allow snap APIs in the Ethereum provider", async () => {
    const CODE = `
      module.exports.onRpcRequest = () => ethereum.request({ method: 'snap_dialog', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32601,
            message: 'The method does not exist / is not available.',
            data: {
              cause: null,
              method: 'snap_dialog',
            },
          }),
        },
      },
    });
  });

  it('allows direct access to ethereum public properties', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => {
        return ethereum.request({ method: 'eth_blockNumber', params: [] });
      };
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const blockNumRequest = await executor.readRpc();
    expect(blockNumRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      },
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: blockNumRequest.data.id!,
        result: '0xa70e77',
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: '0xa70e77',
    });
  });

  it('allows direct access to snap public properties', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => {
        snap.request;
        return snap.request({ method: 'wallet_getSnaps', params: [] }) };
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'snap.request' },
    });

    const getSnapsRequest = await executor.readRpc();
    expect(getSnapsRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'wallet_getSnaps',
        params: [],
      },
    });

    const mockSnapsResult = {
      snaps: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'npm:@metamask/example-snap': {
          version: '1.0.0',
        },
      },
    };
    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: getSnapsRequest.data.id!,
        result: mockSnapsResult,
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'snap.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: mockSnapsResult,
    });
  });

  it("doesn't allow direct access to ethereum internals", async () => {
    const CODE = `
      module.exports.onRpcRequest = () =>
        ethereum._rpcEngine.handle({ method: 'snap_dialog', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            message: expect.stringMatching(
              /Cannot read properties of undefined \(reading 'handle'\)|ethereum\._rpcEngine is undefined/u,
            ),
          }),
        },
      },
    });
  });

  it('only allows certain methods in snap API', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => snap.request({ method: 'eth_blockNumber', params: [] });
    `;
    const executor = new TestSnapExecutor();

    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32004,
            message:
              'The global Snap API only allows RPC methods starting with `wallet_*` and `snap_*`.',
          }),
        },
      },
    });
  });

  it("doesn't allow eth_requestAccounts in the snap.request", async () => {
    const CODE = `
      module.exports.onRpcRequest = () => snap.request({ method: 'eth_requestAccounts', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32004,
            message:
              'The global Snap API only allows RPC methods starting with `wallet_*` and `snap_*`.',
          }),
        },
      },
    });
  });

  it('only allows certain methods in ethereum API', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => ethereum.request({ method: 'snap_dialog', params: [] });
    `;
    const executor = new TestSnapExecutor();

    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32601,
            message: 'The method does not exist / is not available.',
            data: {
              cause: null,
              method: 'snap_dialog',
            },
          }),
        },
      },
    });
  });

  it('sanitizes JSON before checking for blocked methods using snap global', async () => {
    const CODE = `
    const badToJSON = () => {
      const x = []

      x.method = 'snap_dialog';

      x.toJSON = () => {
        return {
          method: 'wallet_watchAsset',
          params: [],
        };
      };

      return snap.request(x);
    }

    module.exports.onRpcRequest = () => badToJSON()
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32601,
            message: 'The method does not exist / is not available.',
            data: {
              cause: null,
              method: 'wallet_watchAsset',
            },
          }),
        },
      },
    });
  });

  it('sanitizes JSON before checking for blocked methods using ethereum global', async () => {
    const CODE = `
    const badToJSON = () => {
      const x = []

      x.method = 'eth_requestAccounts';

      x.toJSON = () => {
        return {
          method: 'wallet_watchAsset',
          params: [],
        };
      };

      return ethereum.request(x);
    }

    module.exports.onRpcRequest = () => badToJSON()
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: expect.objectContaining({
            code: -32601,
            message: 'The method does not exist / is not available.',
            data: {
              cause: null,
              method: 'wallet_watchAsset',
            },
          }),
        },
      },
      id: 2,
    });
  });

  it('allows passing undefined parameters to snap.request', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => snap.request({ method: 'snap_getEntropy', params: { version: 1, salt: undefined } });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'snap.request' },
    });

    const request = await executor.readRpc();
    expect(request).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'snap_getEntropy',
        params: {
          version: 1,
        },
      },
    });

    // From getEntropy test vectors
    const result =
      '0x8bbb59ec55a4a8dd5429268e367ebbbe54eee7467c0090ca835c64d45c33a155';

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: request.data.id!,
        result,
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'snap.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result,
    });
  });

  it('allows passing undefined parameters to ethereum.request', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => ethereum.request({ method: 'eth_call', params: [{
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        nonce: undefined,
        gas: undefined,
        data: '0x70a082310000000000000000000000004bbeeb066ed09b7aed07bf39eee0460dfa261520',
      }] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const request = await executor.readRpc();
    expect(request).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            data: '0x70a082310000000000000000000000004bbeeb066ed09b7aed07bf39eee0460dfa261520',
          },
        ],
      },
    });

    const result =
      '0x00000000000000000000000000000000000000000000000000000010a7a512a9';

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: request.data.id!,
        result,
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result,
    });
  });

  it('reports when outbound requests are made using fetch', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => fetch('https://metamask.io').then(res => res.text());
    `;

    const fetchSpy = spy(globalThis, 'fetch');

    fetchSpy.mockImplementation(async () => {
      return new Response('foo');
    });

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['fetch']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'foo',
    });
  });

  it('uses a response for fetch that works with instanceof', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => fetch('https://metamask.io').then(res => res instanceof Response);
    `;

    const fetchSpy = spy(globalThis, 'fetch');

    fetchSpy.mockImplementation(async () => {
      return new Response('foo');
    });

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['fetch', 'Response']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'fetch' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: true,
    });
  });

  it('notifies execution service of out of band errors via unhandledrejection', async () => {
    const CODE = `
      module.exports.onRpcRequest = async () => 'foo';
    `;

    const addEventListenerSpy = spy(globalThis, 'addEventListener');

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'foo',
    });

    // The executor listens for unhandledrejection events on the `window`
    // object, so we dispatch one here.
    assert(addEventListenerSpy.calls[0].args[0] === 'unhandledrejection');
    const listener = addEventListenerSpy.calls[0].args[1] as EventListener;

    const error = new Error('Test error.');
    listener(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(error),
        reason: error,
      }),
    );

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'UnhandledError',
      params: {
        error: {
          code: -32603,
          data: {
            snapId: MOCK_SNAP_ID,
            cause: expect.objectContaining({
              message: 'Test error.',
            }),
          },
          message: 'Unhandled Snap Error',
        },
      },
    });

    addEventListenerSpy.reset();
  });

  it('notifies execution service of out of band errors via error event', async () => {
    const CODE = `
      module.exports.onRpcRequest = async () => 'foo';
    `;

    const addEventListenerSpy = spy(globalThis, 'addEventListener');

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'foo',
    });

    // The executor listens for error events on the `window` object, so we
    // dispatch one here.
    assert(addEventListenerSpy.calls[1].args[0] === 'error');
    const listener = addEventListenerSpy.calls[1].args[1] as EventListener;

    const error = new Error('Test error.');
    listener(new ErrorEvent('error', { error }));

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'UnhandledError',
      params: {
        error: {
          code: -32603,
          data: {
            snapId: MOCK_SNAP_ID,
            cause: expect.objectContaining({
              message: 'Test error.',
            }),
          },
          message: 'Unhandled Snap Error',
        },
      },
    });

    addEventListenerSpy.reset();
  });

  it('throws an internal error if the Snap fails to start', async () => {
    const CODE = `
      throw new Error('Failed to start.');
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      error: expect.objectContaining({
        code: -32603,
        message: `Error while running snap '${MOCK_SNAP_ID}': Failed to start.`,
        data: {
          cause: expect.objectContaining({
            code: -32603,
            message: 'Failed to start.',
          }),
        },
      }),
    });
  });

  it("throws if the Snap doesn't export anything", async () => {
    const CODE = ``;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      error: expect.objectContaining({
        code: -32603,
        message: `Error while running snap '${MOCK_SNAP_ID}': Snap has no valid exports.`,
        data: {
          cause: expect.objectContaining({
            code: -32603,
            message: 'Snap has no valid exports.',
          }),
        },
      }),
    });
  });

  it('supports onTransaction export', async () => {
    const CODE = `
      module.exports.onTransaction = ({ transaction, chainId, transactionOrigin }) =>
        ({ transaction, chainId, transactionOrigin });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    // TODO: Update the value to be closer to the value we expect from the
    //  extension. We also have to decide on the shape of that object.
    const transaction = { maxFeePerGas: '0x' };

    const params = {
      transaction,
      chainId: 'eip155:1',
      transactionOrigin: null,
    };

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnTransaction,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: params,
    });
  });

  it('supports onCronjob export', async () => {
    const CODE = `
      module.exports.onCronjob = ({ request }) => request.params[0];
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnCronjob,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params: ['bar'] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'bar',
    });
  });

  it('supports onNameLookup export for domain lookup', async () => {
    const CODE = `module.exports.onNameLookup = ({ chainId, domain }) => domain`;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnNameLookup,
        MOCK_ORIGIN,
        {
          jsonrpc: '2.0',
          method: 'foo',
          params: { chainId: 'eip155:1', domain: 'foo.lens' },
        },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'foo.lens',
    });
  });

  it('supports onNameLookup export for address lookup', async () => {
    const CODE = `module.exports.onNameLookup = ({ chainId, address }) => address`;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnNameLookup,
        MOCK_ORIGIN,
        {
          jsonrpc: '2.0',
          method: 'foo',
          params: {
            chainId: 'eip155:1',
            address: '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb',
          },
        },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb',
    });
  });

  it('supports onKeyringRequest export', async () => {
    const CODE = `
      module.exports.onKeyringRequest = ({ request }) => request.params[0];
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnKeyringRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params: ['bar'] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'bar',
    });
  });

  it('supports onHomePage export', async () => {
    const CODE = `
      module.exports.onHomePage = () => ({ content: { type: 'panel', children: [] }});
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnHomePage,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '' },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: { content: { type: 'panel', children: [] } },
    });
  });

  it('supports onSettingsPage export', async () => {
    const CODE = `
      module.exports.onSettingsPage = () => ({ content: { type: 'panel', children: [] }});
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnSettingsPage,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '' },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: { content: { type: 'panel', children: [] } },
    });
  });

  it('supports `onAssetsLookup` export', async () => {
    const CODE = `
      module.exports.onAssetsLookup = () => ({ assets: {} });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnAssetsLookup,
        MOCK_ORIGIN,
        {
          jsonrpc: '2.0',
          method: '',
          params: {
            assets: ['bip122:000000000019d6689c085ae165831e93/slip44:0'],
          },
        },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: { assets: {} },
    });
  });

  it('supports `onAssetsConversion` export', async () => {
    const CODE = `
      module.exports.onAssetsConversion = () => ({ conversionRates: {} });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnAssetsConversion,
        MOCK_ORIGIN,
        {
          jsonrpc: '2.0',
          method: '',
          params: {
            conversions: [
              {
                from: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
                to: 'eip155:1/slip44:60',
              },
            ],
          },
        },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: { conversionRates: {} },
    });
  });

  it('supports onSignature export', async () => {
    const CODE = `
      module.exports.onSignature = ({ signature, signatureOrigin }) =>
        ({ signature, signatureOrigin });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    const signature = {
      from: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      data: 'Hello, Bob!',
    };

    const params = {
      signature,
      signatureOrigin: 'https://www.uniswap.org',
    };

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnSignature,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: params,
    });
  });

  it('supports onUserInput export', async () => {
    const CODE = `
      module.exports.onUserInput = ({ id, event }) => {}
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    const params = {
      id: 'foo',
      event: {
        type: UserInputEventType.ButtonClickEvent,
        name: 'bar',
      },
    };

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnUserInput,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: null,
    });
  });

  it('returns null if no onUserInput export is found', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => {}
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    const params = {
      id: 'foo',
      event: {
        type: UserInputEventType.ButtonClickEvent,
        name: 'bar',
      },
    };

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnUserInput,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: null,
    });
  });

  it('supports onProtocolRequest export', async () => {
    const CODE = `
      module.exports.onProtocolRequest = ({ origin, scope, request }) => ({ origin, scope, request })
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    const params = {
      scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      request: {
        jsonrpc: '2.0',
        id: 'foo',
        method: 'getVersion',
      },
    };

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnProtocolRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: { origin: MOCK_ORIGIN, ...params },
    });
  });

  describe('lifecycle hooks', () => {
    const LIFECYCLE_HOOKS = [HandlerType.OnInstall, HandlerType.OnUpdate];

    for (const handler of LIFECYCLE_HOOKS) {
      // eslint-disable-next-line no-loop-func
      it(`supports \`${handler}\` export`, async () => {
        const CODE = `
          module.exports.${handler} = ({ origin }) => origin;
        `;

        const executor = new TestSnapExecutor();
        await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

        expect(await executor.readCommand()).toStrictEqual({
          jsonrpc: '2.0',
          id: 1,
          result: 'OK',
        });

        await executor.writeCommand({
          jsonrpc: '2.0',
          id: 2,
          method: 'snapRpc',
          params: [
            MOCK_SNAP_ID,
            handler,
            MOCK_ORIGIN,
            { jsonrpc: '2.0', method: handler },
          ],
        });

        expect(await executor.readCommand()).toStrictEqual({
          id: 2,
          jsonrpc: '2.0',
          result: MOCK_ORIGIN,
        });
      });

      // eslint-disable-next-line no-loop-func
      it(`does not throw if \`${handler}\` is called, but the snap does not export it`, async () => {
        const CODE = `
          module.exports.onRpcRequest = () => 'foo';
        `;

        const executor = new TestSnapExecutor();
        await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

        expect(await executor.readCommand()).toStrictEqual({
          jsonrpc: '2.0',
          id: 1,
          result: 'OK',
        });

        await executor.writeCommand({
          jsonrpc: '2.0',
          id: 2,
          method: 'snapRpc',
          params: [
            MOCK_SNAP_ID,
            handler,
            MOCK_ORIGIN,
            { jsonrpc: '2.0', method: 'foo', params: ['bar'] },
          ],
        });

        expect(await executor.readCommand()).toStrictEqual({
          id: 2,
          jsonrpc: '2.0',
          result: null,
        });
      });
    }
  });

  it('blocks snaps from escaping confinement by using unbound this', async () => {
    const consoleSpy = spy(console, 'log');

    const PAYLOAD = `
      console.log('Payload executed.');
    `;

    const CODE = `
      exports.onRpcRequest = async function() {
        await this.startSnap("payload", \`${PAYLOAD}\`, ['console'])
        return 'Payload has been sent.';
      }
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -31001,
        data: {
          cause: expect.objectContaining({
            message: expect.stringMatching(
              /Cannot read properties of undefined \(reading 'startSnap'\)|this is undefined/u,
            ),
          }),
        },
        message: 'Wrapped Snap Error',
      },
    });

    expect(executor.commandBuffer).toHaveLength(0);
    expect(consoleSpy.calls).not.toContainEqual({
      args: ['Payload executed.'],
      result: undefined,
    });

    consoleSpy.reset();
  });

  it('does not return control to a snap after idle teardown', async () => {
    const consoleSpy = spy(console, 'log');

    const CODE = `
      let promise;

      module.exports.onRpcRequest = async ({request}) => {
        switch (request.method) {
          case 'first':
            promise = ethereum.request({ method: 'eth_blockNumber', params: [] })
              .then(() => console.log('Jailbreak.'));
            return 'First call is ok.';
          case 'second':
            const timeout = new Promise((r) => setTimeout(() => r('Timeout resolved for second call.'), 1000));
            return Promise.race([timeout, promise.then(() => 'Second call is ok.')]);
        }
      }
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, [
      ...TIMER_ENDOWMENTS,
      'ethereum',
    ]);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'first', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const blockNumRequest = await executor.readRpc();
    expect(blockNumRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'First call is ok.',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 3,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'second', params: [] },
      ],
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: blockNumRequest.data.id!,
        result: '0xa70e77',
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 3,
      jsonrpc: '2.0',
      result: 'Timeout resolved for second call.',
    });

    expect(executor.commandBuffer).toHaveLength(0);
    expect(consoleSpy.calls).not.toContainEqual({
      args: ['Jailbreak.'],
      result: undefined,
    });

    consoleSpy.reset();
  });

  it('does not return control to a snap after idle teardown when request fails', async () => {
    const consoleSpy = spy(console, 'log');

    const CODE = `
      let promise;

      module.exports.onRpcRequest = async ({request}) => {
        switch (request.method) {
          case 'first':
            promise = ethereum.request({ method: 'eth_blockNumber', params: [] })
              .catch(() => console.log('Jailbreak.'));
            return 'First call is ok.';
          case 'second':
            const timeout = new Promise((r) => setTimeout(() => r('Timeout resolved for second call.'), 1000));
            return Promise.race([timeout, promise.then(() => 'Second call is ok.')]);
        }
      }
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, [
      ...TIMER_ENDOWMENTS,
      'ethereum',
    ]);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'first', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const blockNumRequest = await executor.readRpc();
    expect(blockNumRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      result: 'First call is ok.',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 3,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'second', params: [] },
      ],
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: blockNumRequest.data.id!,
        error: {
          message: 'Error in RPC request',
          code: -1000,
        },
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 3,
      jsonrpc: '2.0',
      result: 'Timeout resolved for second call.',
    });

    expect(executor.commandBuffer).toHaveLength(0);
    expect(consoleSpy.calls).toHaveLength(0);
  });

  it('should handle promise rejection that is passed through the proxy', async () => {
    // This will ensure that the reject(reason); is called from inside the proxy
    // method when the original promise throws an error (i.e., JSON-RPC request
    // fails).
    const CODE = `
      module.exports.onRpcRequest = () =>
        ethereum.request({ method: 'eth_blockNumber', params: [] });
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundRequest',
      params: { source: 'ethereum.request' },
    });

    const blockNumRequest = await executor.readRpc();
    expect(blockNumRequest).toStrictEqual({
      name: 'metamask-provider',
      data: {
        id: expect.any(Number),
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
      },
    });

    await executor.writeRpc({
      name: 'metamask-provider',
      data: {
        jsonrpc: '2.0',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        id: blockNumRequest.data.id!,
        error: {
          message: 'Error in RPC request. Cannot get block number.',
          code: -1000,
        },
      },
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      method: 'OutboundResponse',
      params: { source: 'ethereum.request' },
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      error: expect.anything(),
    });
  });

  it('throws when trying to respond with unserializable values', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => BigInt(0);
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32603,
        message:
          'Received non-JSON-serializable value: Expected a value of type `JSON`, but received: `0`',
        stack: expect.any(String),
      },
    });
  });

  it('throws when trying to respond with value that is too large', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => '1'.repeat(100_000_000);
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32603,
        message:
          'JSON-RPC responses must be JSON serializable objects smaller than 64 MB.',
        stack: expect.any(String),
      },
    });
  });

  it('throws when receiving an invalid RPC request', async () => {
    const executor = new TestSnapExecutor();

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        // @ts-expect-error Invalid JSON
        { jsonrpc: '2.0', method: 'foo', params: undefined },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32603,
        message: 'JSON-RPC requests must be JSON serializable objects.',
        stack: expect.any(String),
      },
    });
  });

  it('logs when receiving an invalid RPC request that cannot be responded to', async () => {
    const executor = new TestSnapExecutor();

    const consoleSpy = spy(console, 'log');

    await executor.writeCommand({
      jsonrpc: '2.0',
      // @ts-expect-error Invalid JSON
      id: undefined,
      method: 'snapRpc',
      params: [MOCK_SNAP_ID, HandlerType.OnRpcRequest, MOCK_ORIGIN, {}],
    });

    expect(consoleSpy.calls[0]?.args[0]).toStrictEqual(
      'Command stream received a non-JSON-RPC request, and was unable to respond.',
    );
  });

  it('contains the self-referential global scopes', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => globalThis !== undefined &&
        globalThis.self === self &&
        globalThis === self.self &&
        globalThis === window &&
        globalThis === global &&
        globalThis === global.global;
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 2,
      result: true,
    });
  });

  it('handles `SnapError`s', async () => {
    const CODE = `
      module.exports.onRpcRequest = () => {
        class SnapError {
          serialize() {
            return {
              code: -31002,
              message: 'Snap Error',
              data: {
                cause: {
                  code: -1,
                  message: 'Snap error message.',
                },
              },
            };
          }
        }

        throw new SnapError();
      };
    `;

    const executor = new TestSnapExecutor();
    await executor.executeSnap(1, MOCK_SNAP_ID, CODE, []);

    expect(await executor.readCommand()).toStrictEqual({
      jsonrpc: '2.0',
      id: 1,
      result: 'OK',
    });

    await executor.writeCommand({
      jsonrpc: '2.0',
      id: 2,
      method: 'snapRpc',
      params: [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: 'foo', params: {} },
      ],
    });

    expect(await executor.readCommand()).toStrictEqual({
      id: 2,
      jsonrpc: '2.0',
      error: {
        code: -31001,
        message: 'Wrapped Snap Error',
        data: {
          cause: {
            code: -31002,
            message: 'Snap Error',
            data: {
              cause: {
                code: -1,
                message: 'Snap error message.',
              },
            },
          },
        },
      },
    });
  });

  describe('executeSnap', () => {
    [
      {
        snapId: 1,
        code: 'module.exports.onRpcRequest = () => 1;',
        endowments: [],
      },
      {
        snapId: MOCK_SNAP_ID,
        code: 1,
        endowments: [],
      },
      {
        snapId: MOCK_SNAP_ID,
        code: 'module.exports.onRpcRequest = () => 1;',
        endowments: ['foo', 1],
      },
      [1, 'module.exports.onRpcRequest = () => 1;', []],
      [MOCK_SNAP_ID, 1, []],
      [MOCK_SNAP_ID, 'module.exports.onRpcRequest = () => 1;', ['foo', 1]],
    ].forEach((params) => {
      it('throws an error if the request arguments are invalid', async () => {
        const executor = new TestSnapExecutor();

        await executor.writeCommand({
          jsonrpc: '2.0',
          id: 1,
          method: 'executeSnap',
          params,
        });

        expect(await executor.readCommand()).toStrictEqual({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            data: expect.any(Object),
            message: expect.any(String),
            stack: expect.any(String),
          },
        });
      });
    });
  });

  describe('snapRpc', () => {
    [
      {
        snapId: 1,
        method: HandlerType.OnRpcRequest,
        origin: MOCK_ORIGIN,
        request: { jsonrpc: '2.0', method: '', params: [] },
      },
      {
        snapId: MOCK_SNAP_ID,
        method: 1,
        origin: MOCK_ORIGIN,
        request: { jsonrpc: '2.0', method: '', params: [] },
      },
      {
        snapId: MOCK_SNAP_ID,
        method: HandlerType.OnRpcRequest,
        origin: 1,
        request: { jsonrpc: '2.0', method: '', params: [] },
      },
      {
        snapId: MOCK_SNAP_ID,
        method: HandlerType.OnRpcRequest,
        origin: MOCK_ORIGIN,
        request: 1,
      },
      [
        1,
        HandlerType.OnRpcRequest,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
      [
        MOCK_SNAP_ID,
        1,
        MOCK_ORIGIN,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
      [
        MOCK_SNAP_ID,
        HandlerType.OnRpcRequest,
        1,
        { jsonrpc: '2.0', method: '', params: [] },
      ],
      [MOCK_SNAP_ID, HandlerType.OnRpcRequest, MOCK_ORIGIN, 1],
    ].forEach((params) => {
      it('throws an error if the request arguments are invalid', async () => {
        const executor = new TestSnapExecutor();

        await executor.writeCommand({
          jsonrpc: '2.0',
          id: 1,
          method: 'snapRpc',
          params,
        });

        expect(await executor.readCommand()).toStrictEqual({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32602,
            data: expect.any(Object),
            message: expect.any(String),
            stack: expect.any(String),
          },
        });
      });
    });
  });

  describe('onCommandRequest', () => {
    it('throws a human-readable error if the request arguments are invalid', async () => {
      const executor = new TestSnapExecutor();
      const params = {
        snapId: 1,
        method: HandlerType.OnRpcRequest,
        origin: MOCK_ORIGIN,
        request: { jsonrpc: '2.0', method: '', params: [] },
      };

      await executor.writeCommand({
        jsonrpc: '2.0',
        id: 1,
        method: 'snapRpc',
        params,
      });

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32602,
          data: expect.any(Object),
          message:
            'Invalid parameters for method "snapRpc": At path: 0 -- Expected a string, but received: 1.',
          stack: expect.any(String),
        },
      });
    });
  });

  describe('hardening', () => {
    before(() => {
      // We define a global `harden` function for the tests, but the `lockdown`
      // function will fail if such function is already defined. We therefore
      // delete it here.
      // @ts-expect-error - `globalThis.harden` is not optional.
      delete globalThis.harden;

      lockdown({
        domainTaming: 'unsafe',
        errorTaming: 'unsafe',
        stackFiltering: 'verbose',
      });
    });

    it('hardens the snap and ethereum endowments', async () => {
      const CODE = `
      module.exports.onRpcRequest = () => {
        let result = {
          hasMethods: {},
          errors: [],
        };

        try {
          result.hasMethods = {
            ethereum: {
              request: 'request' in ethereum,
              on: 'on' in ethereum,
              removeListener: 'removeListener' in ethereum,
              rpcEngine: '_rpcEngine' in ethereum,
            },
            snap: {
              request: 'request' in snap,
              on: 'on' in snap,
              removeListener: 'removeListener' in snap,
              rpcEngine: '_rpcEngine' in snap,
              requestType: typeof snap.request,
            }
          }
        } catch (error) {
          result.errors.push(error.message);
        }

        return result;
      }
    `;

      const executor = new TestSnapExecutor();
      await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 1,
        result: 'OK',
      });

      await executor.writeCommand({
        jsonrpc: '2.0',
        id: 2,
        method: 'snapRpc',
        params: [
          MOCK_SNAP_ID,
          HandlerType.OnRpcRequest,
          MOCK_ORIGIN,
          { jsonrpc: '2.0', method: '', params: [] },
        ],
      });

      expect(await executor.readCommand()).toStrictEqual({
        jsonrpc: '2.0',
        id: 2,
        result: {
          errors: [],
          hasMethods: {
            ethereum: {
              request: true,
              on: false,
              removeListener: false,
              rpcEngine: false,
            },
            snap: {
              request: true,
              on: false,
              removeListener: false,
              rpcEngine: false,
              requestType: 'function',
            },
          },
        },
      });
    });

    ['ethereum', 'snap'].forEach((endowment) => {
      it(`properly hardens ${endowment}`, async () => {
        const CODE = `
        module.exports.onRpcRequest = () => {
          let result = 'ENDOWMENT_SECURED';
          let errors = [];

          try {
            errors = (${testEndowmentHardening})(${endowment}, () => ${endowment});
            if (${endowment}.__flag) {
              result = 'ENDOWMENT_NOT_SECURED';
            }
            if (${endowment}.__proto__ && ${endowment}.__proto__.__flag) {
              result = 'ENDOWMENT_NOT_SECURED';
            }
            if (${endowment}.prototype && ${endowment}.prototype.__flag) {
              result = 'ENDOWMENT_NOT_SECURED';
            }
            const objectProto = Object.getPrototypeOf(${endowment});
            if (objectProto.__flag) {
              result = 'ENDOWMENT_NOT_SECURED';
            }
          } catch (error) {
            return error.message;
          }

          return {
            result: result,
            errors: errors,
          };
        };
      `;

        const executor = new TestSnapExecutor();
        await executor.executeSnap(1, MOCK_SNAP_ID, CODE, ['ethereum']);

        expect(await executor.readCommand()).toStrictEqual({
          jsonrpc: '2.0',
          id: 1,
          result: 'OK',
        });

        await executor.writeCommand({
          jsonrpc: '2.0',
          id: 2,
          method: 'snapRpc',
          params: [
            MOCK_SNAP_ID,
            HandlerType.OnRpcRequest,
            MOCK_ORIGIN,
            { jsonrpc: '2.0', method: '', params: [] },
          ],
        });

        const command = await executor.readCommand();

        assertIsJsonRpcSuccess(command);
        assert(isPlainObject(command.result));

        expect(command.result.errors).toHaveLength(5);
        expect(command).toStrictEqual({
          jsonrpc: '2.0',
          id: 2,
          result: {
            result: 'ENDOWMENT_SECURED',
            errors: expect.any(Array),
          },
        });
      });
    });

    // This test will ensure that the custom endowment does not leak reference to
    // `globalThis` by using object walker to walk object properties and search
    // for it. Because of the same architectural design of a snap and ethereum
    // endowments, it is enough to test one of them (both are StreamProviders
    // going through proxy).
    it('does not leak `globalThis` in custom endowments', async () => {
      // Because of encapsulation of the endowment implemented in
      // `BaseSnapExecutor`, mocked version is used and will reflect the same use
      // case that is suitable for security auditing of this type.
      const provider = getMockedStreamProvider();
      expect(walkAndSearch(provider, globalThis)).toBe(false);
    });

    it('does not leak real prototype in custom endowments', async () => {
      // Because of encapsulation of the endowment implemented in
      // `BaseSnapExecutor`, mocked version is used and will reflect the same use
      // case that is suitable for security auditing of this type.
      const provider = getMockedStreamProvider();
      expect(Object.getPrototypeOf(provider)).toStrictEqual({});
    });
  });
});
