import { RowVariant, row } from './row';
import { text } from './text';
import { NodeType } from '../nodes';

describe('row', () => {
  it('creates a row component', () => {
    expect(row({ label: 'Label', value: text('Hello, world!') })).toStrictEqual(
      {
        type: NodeType.Row,
        label: 'Label',
        value: text('Hello, world!'),
      },
    );

    expect(
      row({
        label: 'Label',
        value: text('Hello, world!'),
        variant: RowVariant.Critical,
      }),
    ).toStrictEqual({
      type: NodeType.Row,
      label: 'Label',
      value: text('Hello, world!'),
      variant: RowVariant.Critical,
    });

    expect(
      row({
        label: 'Label',
        value: text('Hello, world!'),
        variant: 'critical',
      }),
    ).toStrictEqual({
      type: NodeType.Row,
      label: 'Label',
      value: text('Hello, world!'),
      variant: RowVariant.Critical,
    });
  });

  it('creates a row component using the shorthand form', () => {
    expect(row('Label', text('Hello, world!'))).toStrictEqual({
      type: NodeType.Row,
      label: 'Label',
      value: text('Hello, world!'),
    });

    expect(
      row('Label', text('Hello, world!'), RowVariant.Critical),
    ).toStrictEqual({
      type: NodeType.Row,
      label: 'Label',
      value: text('Hello, world!'),
      variant: RowVariant.Critical,
    });

    expect(row('Label', text('Hello, world!'), 'critical')).toStrictEqual({
      type: NodeType.Row,
      label: 'Label',
      value: text('Hello, world!'),
      variant: RowVariant.Critical,
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => row({ label: 'bar', value: text('foo'), bar: 'baz' })).toThrow(
      'Invalid row component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => row({})).toThrow(
      'Invalid row component: At path: value -- Expected the value to satisfy a union of `object | object | object`, but received: undefined.',
    );
  });
});
