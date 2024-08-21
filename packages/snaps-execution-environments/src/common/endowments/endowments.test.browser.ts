/* eslint-disable import-x/no-unassigned-import, @typescript-eslint/restrict-template-expressions */

import 'ses';

import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import buildCommonEndowments from './commonEndowmentFactory';
import consoleEndowment from './console';
import CryptoEndowment from './crypto';
import date from './date';
import interval from './interval';
import math from './math';
import network from './network';
import timeout from './timeout';
import { walkAndSearch } from '../test-utils/endowments';
import { testEndowmentHardening } from '../test-utils/hardening';

// @ts-expect-error - `globalThis.process` is not optional.
delete globalThis.process;

const originalAtob = globalThis.atob.bind(globalThis);
const originalBtoa = globalThis.btoa.bind(globalThis);

lockdown({
  domainTaming: 'unsafe',
  errorTaming: 'unsafe',
  stackFiltering: 'verbose',
  overrideTaming: 'severe',
});

// This is a hack to make `atob`, and `btoa` hardening work. This needs to be
// investigated further.
globalThis.atob = harden(originalAtob);
globalThis.btoa = harden(originalBtoa);

const mockNotify = () => {
  // no-op
};

describe('endowments', () => {
  describe('hardening', () => {
    const modules = buildCommonEndowments();
    modules.forEach((endowment) =>
      endowment.factory({ snapId: MOCK_SNAP_ID, notify: mockNotify }),
    );

    // Specially attenuated endowments or endowments that require
    // to be imported in a different way
    const { SubtleCrypto: SubtleCryptoEndowment, crypto } =
      CryptoEndowment.factory();
    const {
      setTimeout: setTimeoutAttenuated,
      clearTimeout: clearTimeoutAttenuated,
    } = timeout.factory();
    const {
      setInterval: setIntervalAttenuated,
      clearInterval: clearIntervalAttenuated,
    } = interval.factory();
    const { Math: mathAttenuated } = math.factory();
    const {
      fetch: fetchAttenuated,
      Request: RequestHardened,
      Headers: HeadersHardened,
      Response: ResponseHardened,
    } = network.factory({
      notify: mockNotify,
    });
    const { Date: DateAttenuated } = date.factory();
    const { console: consoleAttenuated } = consoleEndowment.factory({
      snapId: MOCK_SNAP_ID,
    });

    const TEST_ENDOWMENTS = {
      // Constructor functions.
      BigInt: {
        endowments: { BigInt },
        factory: () => BigInt(3),
      },
      SubtleCrypto: {
        endowments: { SubtleCrypto: SubtleCryptoEndowment },
        factory: () => undefined,
      },
      TextDecoder: {
        endowments: { TextDecoder },
        factory: () => new TextDecoder(),
      },
      TextEncoder: {
        endowments: { TextEncoder },
        factory: () => new TextEncoder(),
      },
      URL: {
        endowments: { URL },
        factory: () => new URL('https://metamask.io/snaps/'),
      },
      Int8Array: {
        endowments: { Int8Array },
        factory: () => new Int8Array(),
      },
      Uint8Array: {
        endowments: { Uint8Array },
        factory: () => new Uint8Array(),
      },
      Uint8ClampedArray: {
        endowments: { Uint8ClampedArray },
        factory: () => new Uint8ClampedArray(),
      },
      Int16Array: {
        endowments: { Int16Array },
        factory: () => new Int16Array(),
      },
      Uint16Array: {
        endowments: { Uint16Array },
        factory: () => new Uint16Array(),
      },
      Int32Array: {
        endowments: { Int32Array },
        factory: () => new Int32Array(),
      },
      Uint32Array: {
        endowments: { Uint32Array },
        factory: () => new Uint32Array(),
      },
      Float32Array: {
        endowments: { Float32Array },
        factory: () => new Float32Array(),
      },
      Float64Array: {
        endowments: { Float64Array },
        factory: () => new Float64Array(),
      },
      BigInt64Array: {
        endowments: { BigInt64Array },
        factory: () => new BigInt64Array(),
      },
      BigUint64Array: {
        endowments: { BigUint64Array },
        factory: () => new BigUint64Array(),
      },
      DataView: {
        endowments: { DataView, ArrayBuffer },
        factory: () => new DataView(new ArrayBuffer(64)),
      },
      ArrayBuffer: {
        endowments: { ArrayBuffer },
        factory: () => new ArrayBuffer(64),
      },
      AbortController: {
        endowments: { AbortController },
        factory: () => new AbortController(),
      },
      AbortSignal: {
        endowments: { AbortSignal },
        // @ts-expect-error - `abort()` method exists in browser, but not in
        // Node.js.
        factory: () => AbortSignal.abort(),
      },
      DateAttenuated: {
        endowments: { DateAttenuated },
        factory: () => new DateAttenuated(),
      },

      // Objects.
      consoleAttenuated: {
        endowments: { consoleAttenuated },
        factory: () => consoleAttenuated,
      },
      crypto: {
        endowments: { crypto },
        factory: () => crypto,
      },
      mathAttenuated: {
        endowments: { mathAttenuated },
        factory: () => mathAttenuated,
      },
      WebAssembly: {
        endowments: { WebAssembly },
        factory: () => WebAssembly,
      },

      // Functions.
      atob: {
        endowments: { atob },
        factory: () => atob('U25hcHM='),
      },
      btoa: {
        endowments: { btoa },
        factory: () => btoa('Snaps'),
      },
      RequestHardened: {
        endowments: { RequestHardened },
        factory: () => new RequestHardened('https://metamask.io'),
      },
      HeadersHardened: {
        endowments: { HeadersHardened },
        factory: () => new HeadersHardened(),
      },
      ResponseHardened: {
        endowments: { ResponseHardened },
        factory: () => new ResponseHardened(),
      },
      setTimeoutAttenuated: {
        endowments: { setTimeoutAttenuated },
        factory: () => setTimeoutAttenuated((param: unknown) => param, 1),
      },
      clearTimeoutAttenuated: {
        endowments: { clearTimeoutAttenuated },
        factory: () => undefined,
      },
      setIntervalAttenuated: {
        endowments: { setIntervalAttenuated },
        factory: () => setIntervalAttenuated((param: unknown) => param, 100000),
      },
      clearIntervalAttenuated: {
        endowments: { clearIntervalAttenuated },
        factory: () => undefined,
      },
      fetchAttenuated: {
        endowments: { fetchAttenuated },
        factory: () => undefined,
      },
    };

    Object.entries(TEST_ENDOWMENTS).forEach(
      ([name, { endowments, factory }]) => {
        it(`hardens ${name}`, () => {
          const sourceCode = `;(${testEndowmentHardening})(${name},${factory})`;
          const subject = endowments[name as keyof typeof endowments] as {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            __flag?: unknown;
          };

          const compartment = new Compartment(endowments, {}, {});

          const errors = compartment.evaluate(sourceCode);
          const instance = factory();

          expect(subject.__flag).toBeUndefined();
          expect(instance?.__flag).toBeUndefined();
          expect(errors.length).toBeGreaterThan(0);
        });

        if (factory()) {
          it(`${name} does not leak 'globalThis'`, () => {
            const instance = factory();
            expect(walkAndSearch(instance, globalThis)).toBe(false);
          });
        }
      },
    );
  });

  describe('commonEndowmentFactory', () => {
    it('creates endowments with the expected properties', () => {
      const endowments = buildCommonEndowments();
      expect(endowments).toStrictEqual([
        {
          factory: expect.any(Function),
          names: ['crypto', 'SubtleCrypto'],
        },
        {
          factory: expect.any(Function),
          names: ['setInterval', 'clearInterval'],
        },
        {
          factory: expect.any(Function),
          names: ['Math'],
        },
        {
          factory: expect.any(Function),
          names: ['fetch', 'Request', 'Headers', 'Response'],
        },
        {
          factory: expect.any(Function),
          names: ['setTimeout', 'clearTimeout'],
        },
        {
          factory: expect.any(Function),
          names: ['TextDecoder'],
        },
        {
          factory: expect.any(Function),
          names: ['TextEncoder'],
        },
        {
          factory: expect.any(Function),
          names: ['Date'],
        },
        {
          factory: expect.any(Function),
          names: ['console'],
        },
        {
          factory: expect.any(Function),
          names: ['AbortController'],
        },
        {
          factory: expect.any(Function),
          names: ['AbortSignal'],
        },
        {
          factory: expect.any(Function),
          names: ['ArrayBuffer'],
        },
        {
          factory: expect.any(Function),
          names: ['atob'],
        },
        {
          factory: expect.any(Function),
          names: ['BigInt'],
        },
        {
          factory: expect.any(Function),
          names: ['BigInt64Array'],
        },
        {
          factory: expect.any(Function),
          names: ['BigUint64Array'],
        },
        {
          factory: expect.any(Function),
          names: ['btoa'],
        },
        {
          factory: expect.any(Function),
          names: ['DataView'],
        },
        {
          factory: expect.any(Function),
          names: ['Float32Array'],
        },
        {
          factory: expect.any(Function),
          names: ['Float64Array'],
        },
        {
          factory: expect.any(Function),
          names: ['Int8Array'],
        },
        {
          factory: expect.any(Function),
          names: ['Int16Array'],
        },
        {
          factory: expect.any(Function),
          names: ['Int32Array'],
        },
        {
          factory: expect.any(Function),
          names: ['Uint8Array'],
        },
        { factory: expect.any(Function), names: ['Uint8ClampedArray'] },
        { factory: expect.any(Function), names: ['Uint16Array'] },
        { factory: expect.any(Function), names: ['Uint32Array'] },
        { factory: expect.any(Function), names: ['URL'] },
        { factory: expect.any(Function), names: ['WebAssembly'] },
      ]);
    });
  });
});
