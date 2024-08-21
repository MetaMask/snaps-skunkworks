import { is } from '@metamask/superstruct';

import { heading } from './heading';
import { panel, PanelStruct, ParentStruct } from './panel';
import { NodeType } from '../nodes';

describe('ParentStruct', () => {
  it('validates that a value is a node with children', () => {
    expect(is(panel([heading('Hello, world!')]), ParentStruct)).toBe(true);
    expect(is(heading('Hello, world!'), ParentStruct)).toBe(false);
  });
});

describe('PanelStruct', () => {
  it('validates that a value is a panel', () => {
    expect(is(panel([heading('Hello, world!')]), PanelStruct)).toBe(true);
    expect(is(heading('Hello, world!'), PanelStruct)).toBe(false);
  });
});

describe('panel', () => {
  it('creates a panel component', () => {
    expect(
      panel({ children: [heading({ value: 'Hello, world!' })] }),
    ).toStrictEqual({
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Heading,
          value: 'Hello, world!',
        },
      ],
    });

    expect(
      panel({
        children: [panel({ children: [heading({ value: 'Hello, world!' })] })],
      }),
    ).toStrictEqual({
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Panel,
          children: [
            {
              type: NodeType.Heading,
              value: 'Hello, world!',
            },
          ],
        },
      ],
    });
  });

  it('creates a panel component using the shorthand form', () => {
    expect(panel([heading('Hello, world!')])).toStrictEqual({
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Heading,
          value: 'Hello, world!',
        },
      ],
    });

    expect(panel([panel([heading('Hello, world!')])])).toStrictEqual({
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Panel,
          children: [
            {
              type: NodeType.Heading,
              value: 'Hello, world!',
            },
          ],
        },
      ],
    });
  });

  it('validates the args', () => {
    // @ts-expect-error - Invalid args.
    expect(() => panel({ children: [], bar: 'baz' })).toThrow(
      'Invalid panel component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => panel({})).toThrow(
      'Invalid panel component: At path: children -- Expected an array value, but received: undefined.',
    );
  });
});
