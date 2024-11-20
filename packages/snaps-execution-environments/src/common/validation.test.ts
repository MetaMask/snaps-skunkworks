import { UserInputEventType } from '@metamask/snaps-sdk';

import {
  assertIsOnAssetsConversionRequestArguments,
  assertIsOnAssetsLookupRequestArguments,
  assertIsOnNameLookupRequestArguments,
  assertIsOnProtocolRequestArguments,
  assertIsOnSignatureRequestArguments,
  assertIsOnTransactionRequestArguments,
  assertIsOnUserInputRequestArguments,
  isEndowment,
  isEndowmentsArray,
} from './validation';

describe('isEndowment', () => {
  it.each(['foo', 'bar', 'baz'])('returns true for %s', (value) => {
    expect(isEndowment(value)).toBe(true);
  });

  it.each([true, false, null, undefined, 0, 1, [], {}])(
    'returns false for %s',
    (value) => {
      expect(isEndowment(value)).toBe(false);
    },
  );
});

describe('isEndowmentsArray', () => {
  it.each([
    { array: ['foo', 'bar', 'baz'] },
    { array: ['foo', 'bar', 'baz', 'qux'] },
  ])('returns true for a valid endowments array', ({ array }) => {
    expect(isEndowmentsArray(array)).toBe(true);
  });

  it.each([
    { array: [true, false, null, undefined, 0, 1, [], {}] },
    { array: ['foo', 'bar', 'baz', 0] },
    { array: ['foo', 'bar', 'baz', true] },
    { array: ['foo', 'bar', 'baz', false] },
    { array: ['foo', 'bar', 'baz', null] },
    { array: ['foo', 'bar', 'baz', undefined] },
    { array: ['foo', 'bar', 'baz', []] },
    { array: ['foo', 'bar', 'baz', {}] },
  ])('returns false for an invalid endowments array', (value) => {
    expect(isEndowmentsArray(value)).toBe(false);
  });
});

describe('assertIsOnTransactionRequestArguments', () => {
  it.each([
    { transaction: {}, chainId: 'eip155:1', transactionOrigin: null },
    {
      transaction: { foo: 'bar' },
      chainId: 'bip122:000000000019d6689c085ae165831e93',
      transactionOrigin: null,
    },
    {
      transaction: { bar: 'baz' },
      chainId: 'eip155:2',
      transactionOrigin: null,
    },
  ])('does not throw for a valid transaction params object', (args) => {
    expect(() => assertIsOnTransactionRequestArguments(args)).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { transaction: { foo: 'bar' }, chainId: 1 },
    { transaction: { foo: 'bar' }, chainId: '0x1', foo: 'bar' },
  ])(
    'throws if the value is not a valid transaction params object',
    (value) => {
      expect(() => assertIsOnTransactionRequestArguments(value as any)).toThrow(
        'Invalid request params:',
      );
    },
  );
});

describe('assertIsOnSignatureRequestArguments', () => {
  const FROM_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
  it.each([
    { signature: { from: FROM_ADDRESS, data: 'hello' }, signatureOrigin: null },
    { signature: { from: FROM_ADDRESS, data: {} }, signatureOrigin: null },
  ])('does not throw for a valid signature params object', (args) => {
    expect(() => assertIsOnSignatureRequestArguments(args)).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { signature: 'foo', signatureOrigin: null },
    {
      signature: { from: FROM_ADDRESS, data: 'hello world' },
      signatureOrigin: null,
      foo: 'bar',
    },
  ])('throws if the value is not a valid signature params object', (value) => {
    expect(() => assertIsOnSignatureRequestArguments(value as any)).toThrow(
      'Invalid request params:',
    );
  });
});

describe('assertIsOnNameLookupRequestArguments', () => {
  it.each([
    { chainId: 'eip155:1', domain: 'foo.lens' },
    {
      chainId: 'eip155:1',
      address: '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb',
    },
  ])('does not throw for a valid lookup request object', (args) => {
    expect(() => assertIsOnNameLookupRequestArguments(args)).not.toThrow();
  });

  it.each([
    { chainId: 123, domain: 12 },
    { chainId: 'eip155:1', domain: false },
    { chainId: 'foo' },
    { domain: 'foo.lens' },
    { chainId: 'eip155:1', address: 123 },
    { chainId: 'eip155:1', address: false },
    { address: '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb' },
    {
      chainId: 123,
      domain: 'foo.lens',
      address: '0xab16a96d359ec26a11e2c2b3d8f8b8942d5bfcdb',
    },
  ])(
    'throws if the value is not a valid transaction params object',
    (value) => {
      expect(() => assertIsOnNameLookupRequestArguments(value)).toThrow(
        'Invalid request params:',
      );
    },
  );
});

describe('assertIsOnUserInputRequestArguments', () => {
  it.each([
    {
      id: 'foo',
      event: { type: UserInputEventType.ButtonClickEvent, name: 'foo' },
    },
    {
      id: 'foo',
      event: {
        type: UserInputEventType.FormSubmitEvent,
        name: 'foo',
        value: {
          foo: 'bar',
          file: {
            name: 'foo.svg',
            size: 791,
            contentType: 'image/svg+xml',
            contents: '...',
          },
        },
      },
    },
    {
      id: 'foo',
      event: {
        type: UserInputEventType.InputChangeEvent,
        name: 'input',
        value: 'bar',
      },
    },
  ])('does not throw for a valid user input param object', (value) => {
    expect(() => assertIsOnUserInputRequestArguments(value)).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { id: 2, event: { foo: 'bar' } },
    {
      id: 'foo',
      event: { type: UserInputEventType.ButtonClickEvent, name: 'foo' },
      foo: 'bar',
    },
    {
      id: 'foo',
      event: { type: UserInputEventType.ButtonClickEvent, name: 2 },
    },
    {
      id: 'foo',
      event: { type: 4, name: 'foo' },
    },
    {
      id: 'foo',
      event: {
        type: 'baz',
        name: 'foo',
        value: 'bar',
      },
    },
    {
      id: 'foo',
      event: {
        type: UserInputEventType.FormSubmitEvent,
        name: 'foo',
        value: 'bar',
      },
    },
  ])('throws if the value is not a valid user input params object', (value) => {
    expect(() => assertIsOnUserInputRequestArguments(value as any)).toThrow(
      'Invalid request params:',
    );
  });
});

describe('assertIsOnAssetsLookupRequestArguments', () => {
  it.each([
    { assets: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501'] },
    {
      assets: [
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
        'bip122:000000000019d6689c085ae165831e93/slip44:0',
      ],
    },
  ])('does not throw for a valid assets lookup param object', (value) => {
    expect(() => assertIsOnAssetsLookupRequestArguments(value)).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { assets: [] },
    { assets: ['foo'] },
  ])(
    'throws if the value is not a valid assets lookup params object',
    (value) => {
      expect(() =>
        assertIsOnAssetsLookupRequestArguments(value as any),
      ).toThrow('Invalid request params:');
    },
  );
});

describe('assertIsOnAssetsConversionRequestArguments', () => {
  it.each([
    {
      conversions: [
        {
          from: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
          to: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
        },
      ],
    },
  ])('does not throw for a valid assets conversion param object', (value) => {
    expect(() =>
      assertIsOnAssetsConversionRequestArguments(value),
    ).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { conversions: [] },
    { conversions: ['foo'] },
    { conversions: [{}] },
    { conversions: [{ from: 'foo' }] },
    { conversions: [{ from: 'foo', to: 'foo' }] },
  ])(
    'throws if the value is not a valid assets conversion params object',
    (value) => {
      expect(() =>
        assertIsOnAssetsConversionRequestArguments(value as any),
      ).toThrow('Invalid request params:');
    },
  );
});

describe('assertIsOnProtocolRequestArguments', () => {
  it.each([
    {
      scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      request: {
        jsonrpc: '2.0',
        id: 'foo',
        method: 'getVersion',
      },
    },
    {
      scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      request: {
        jsonrpc: '2.0',
        id: 'foo',
        method: 'getVersion',
        params: {
          foo: 'bar',
        },
      },
    },
  ])('does not throw for a valid protocol request param object', (value) => {
    expect(() => assertIsOnProtocolRequestArguments(value)).not.toThrow();
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'foo',
    [],
    {},
    { request: { foo: 'bar' } },
    {
      request: {
        jsonrpc: '2.0',
        id: 'foo',
        method: 'getVersion',
        params: {
          foo: 'bar',
        },
      },
    },
    {
      scope: 'foo',
      request: {
        jsonrpc: '2.0',
        id: 'foo',
        method: 'getVersion',
      },
    },
  ])(
    'throws if the value is not a valid protocol request params object',
    (value) => {
      expect(() => assertIsOnProtocolRequestArguments(value as any)).toThrow(
        'Invalid request params:',
      );
    },
  );
});
