import { text } from './text';
import { NodeType } from '../nodes';

describe('text', () => {
  it('creates a text component', () => {
    expect(text({ value: 'Hello, world!' })).toStrictEqual({
      type: NodeType.Text,
      value: 'Hello, world!',
    });

    expect(text({ value: 'foo bar' })).toStrictEqual({
      type: NodeType.Text,
      value: 'foo bar',
    });

    expect(text({ value: 'foo bar', markdown: false })).toStrictEqual({
      type: NodeType.Text,
      value: 'foo bar',
      markdown: false,
    });

    expect(text({ value: 'foo bar', markdown: true })).toStrictEqual({
      type: NodeType.Text,
      value: 'foo bar',
      markdown: true,
    });
  });

  it('creates a text component using the shorthand form', () => {
    expect(text('Hello, world!')).toStrictEqual({
      type: NodeType.Text,
      value: 'Hello, world!',
    });

    expect(text('foo bar')).toStrictEqual({
      type: NodeType.Text,
      value: 'foo bar',
    });

    expect(text('Hello, world!', false)).toStrictEqual({
      type: NodeType.Text,
      value: 'Hello, world!',
      markdown: false,
    });

    expect(text('Hello, world!', true)).toStrictEqual({
      type: NodeType.Text,
      value: 'Hello, world!',
      markdown: true,
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => text({ value: 'foo', bar: 'baz' })).toThrow(
      'Invalid text component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => text({})).toThrow(
      'Invalid text component: At path: value -- Expected a string, but received: undefined.',
    );
  });
});
