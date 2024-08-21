import { image } from './image';
import { NodeType } from '../nodes';

const MOCK_SVG = '<svg />';

describe('image', () => {
  it('creates an image component', () => {
    expect(image({ value: MOCK_SVG })).toStrictEqual({
      type: NodeType.Image,
      value: MOCK_SVG,
    });
  });

  it('creates an image component using the shorthand form', () => {
    expect(image(MOCK_SVG)).toStrictEqual({
      type: NodeType.Image,
      value: MOCK_SVG,
    });
  });

  it('validates the args', () => {
    expect(() => image({ value: 'foo' })).toThrow(
      'Invalid image component: At path: value -- Value is not a valid SVG.',
    );

    // @ts-expect-error - Suppressing type error to test runtime handling of invalid input
    expect(() => image({ value: MOCK_SVG, bar: 'baz' })).toThrow(
      'Invalid image component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Suppressing type error to test runtime handling of invalid input
    expect(() => image({})).toThrow(
      'Invalid image component: At path: value -- Expected a string, but received: undefined.',
    );
  });
});
