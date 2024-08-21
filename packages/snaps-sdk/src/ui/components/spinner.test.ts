import { spinner } from './spinner';
import { NodeType } from '../nodes';

describe('spinner', () => {
  it('creates a spinner component', () => {
    expect(spinner()).toStrictEqual({
      type: NodeType.Spinner,
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => spinner({ bar: 'baz' })).toThrow(
      'Invalid spinner component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );
  });
});
