import { heading } from './heading';
import { NodeType } from '../nodes';

describe('heading', () => {
  it('creates a heading component', () => {
    expect(heading({ value: 'Hello, world!' })).toStrictEqual({
      type: NodeType.Heading,
      value: 'Hello, world!',
    });

    expect(heading({ value: 'foo bar' })).toStrictEqual({
      type: NodeType.Heading,
      value: 'foo bar',
    });
  });

  it('creates a heading component using the shorthand form', () => {
    expect(heading('Hello, world!')).toStrictEqual({
      type: NodeType.Heading,
      value: 'Hello, world!',
    });

    expect(heading('foo bar')).toStrictEqual({
      type: NodeType.Heading,
      value: 'foo bar',
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => heading({ value: 'foo', bar: 'baz' })).toThrow(
      'Invalid heading component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => heading({})).toThrow(
      'Invalid heading component: At path: value -- Expected a string, but received: undefined.',
    );
  });
});
