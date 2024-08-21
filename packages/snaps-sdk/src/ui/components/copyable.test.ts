import { copyable } from './copyable';
import { NodeType } from '../nodes';

describe('copyable', () => {
  it('creates a copyable component', () => {
    expect(copyable({ value: 'Hello, world!' })).toStrictEqual({
      type: NodeType.Copyable,
      value: 'Hello, world!',
    });

    expect(copyable({ value: 'foo bar', sensitive: true })).toStrictEqual({
      type: NodeType.Copyable,
      value: 'foo bar',
      sensitive: true,
    });

    expect(copyable({ value: 'foo bar', sensitive: false })).toStrictEqual({
      type: NodeType.Copyable,
      value: 'foo bar',
      sensitive: false,
    });
  });

  it('creates a copyable component using the shorthand form', () => {
    expect(copyable('Hello, world!')).toStrictEqual({
      type: NodeType.Copyable,
      value: 'Hello, world!',
    });

    expect(copyable('foo bar', true)).toStrictEqual({
      type: NodeType.Copyable,
      value: 'foo bar',
      sensitive: true,
    });

    expect(copyable('foo bar', false)).toStrictEqual({
      type: NodeType.Copyable,
      value: 'foo bar',
      sensitive: false,
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => copyable({ value: 'foo', bar: 'baz' })).toThrow(
      'Invalid copyable component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => copyable({})).toThrow(
      'Invalid copyable component: At path: value -- Expected a string, but received: undefined.',
    );
  });
});
