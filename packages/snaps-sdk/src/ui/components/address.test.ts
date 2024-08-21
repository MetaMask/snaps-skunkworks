import { address } from './address';
import { NodeType } from '../nodes';

describe('address', () => {
  const MOCK_ADDRESS = '0x4bbeEB066eD09B7AEd07bF39EEe0460DFa261520';
  it('creates an address component', () => {
    expect(address({ value: MOCK_ADDRESS })).toStrictEqual({
      type: NodeType.Address,
      value: MOCK_ADDRESS,
    });
  });

  it('creates a copyable component using the shorthand form', () => {
    expect(address(MOCK_ADDRESS)).toStrictEqual({
      type: NodeType.Address,
      value: MOCK_ADDRESS,
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => address({ value: 'foo' })).toThrow(
      'Invalid address component: At path: value -- Expected a string matching `/^0x[0-9a-fA-F]{40}$/` but received "foo"',
    );

    expect(() =>
      address({ value: '0x4bbeEB066eD09B7AEd07bF39EEe0460DFa2615200' }),
    ).toThrow(
      'Invalid address component: At path: value -- Expected a string matching `/^0x[0-9a-fA-F]{40}$/` but received "0x4bbeEB066eD09B7AEd07bF39EEe0460DFa2615200"',
    );

    // @ts-expect-error - Invalid args.
    expect(() => address({ value: MOCK_ADDRESS, bar: 'baz' })).toThrow(
      'Invalid address component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => address({})).toThrow(
      'Invalid address component: At path: value -- Expected a string, but received: undefined.',
    );
  });
});
