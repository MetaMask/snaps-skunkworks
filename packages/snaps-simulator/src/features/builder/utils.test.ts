import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Text,
  Form,
  Input,
  Field,
  Button,
  Copyable,
  Heading,
  Option,
  Container,
} from '@metamask/snaps-sdk/jsx';
import type { NodeModel } from '@minoru/react-dnd-treeview';

import {
  boxToCode,
  nodeModelsToComponent,
  getNodeText,
  isValidBoxChild,
  isValidFormChild,
  isValidFieldChild,
  setElementChildren,
  canDropElement,
} from './utils';

describe('isValidBoxChild', () => {
  it('returns true for valid box children', () => {
    const child = Text({ children: 'foo' });
    expect(isValidBoxChild(child)).toBe(true);
  });

  it('returns false for invalid box children', () => {
    const child = Container({ children: Input({ name: 'input' }) });
    expect(isValidBoxChild(child)).toBe(false);
  });
});

describe('isValidFormChild', () => {
  it('returns true for valid form children', () => {
    const child = Button({ children: 'foo' });
    expect(isValidFormChild(child)).toBe(true);
  });

  it('returns false for invalid form children', () => {
    const child = Option({ children: 'foo', value: 'foo' });
    expect(isValidFormChild(child)).toBe(false);
  });
});

describe('isValidFieldChild', () => {
  it('returns true for valid field children', () => {
    const child = Input({ name: 'input' });
    expect(isValidFieldChild(child)).toBe(true);
  });

  it('returns false for invalid field children', () => {
    const child = Option({ children: 'foo', value: 'foo' });
    expect(isValidFieldChild(child)).toBe(false);
  });
});

describe('setElementChildren', () => {
  it('sets the children of a JSX element', () => {
    const element = Box({ children: null });
    const children = Text({ children: 'foo' });

    const result = setElementChildren(element, children, isValidBoxChild);
    expect(result).toStrictEqual(children);
  });

  it('sets the children of a JSX element with a child', () => {
    const element = Box({ children: Text({ children: 'foo' }) });
    const children = Text({ children: 'bar' });

    const result = setElementChildren(element, children, isValidBoxChild);
    expect(result).toStrictEqual([element.props.children, children]);
  });

  it('returns the actual children if the child is invalid', () => {
    const element = Box({
      children: [Text({ children: 'foo' }), Heading({ children: 'baz' })],
    });
    const children = Container({ children: Input({ name: 'input' }) });

    const result = setElementChildren(element, children, isValidBoxChild);
    expect(result).toStrictEqual(element.props.children);
  });
});

describe('nodeModelsToComponent', () => {
  it('creates a component from an array of node models', () => {
    const nodeModels: NodeModel<JSXElement>[] = [
      {
        id: 1,
        parent: 0,
        text: 'parent',
        data: Box({ children: [] }),
      },
      {
        id: 2,
        parent: 1,
        text: 'child',
        data: Box({ children: [] }),
      },
      {
        id: 3,
        parent: 2,
        text: 'child',
        data: Text({ children: 'foo' }),
      },
      {
        id: 4,
        parent: 1,
        text: 'child',
        data: Form({ name: 'form', children: [] }),
      },
      {
        id: 5,
        parent: 4,
        text: 'child',
        // @ts-expect-error children is required.
        data: Field({ children: [] }),
      },
      {
        id: 6,
        parent: 5,
        text: 'child',
        data: Input({ name: 'input' }),
      },
    ];

    const component = nodeModelsToComponent(nodeModels);
    expect(component).toStrictEqual(
      Box({
        children: [
          Box({ children: Text({ children: 'foo' }) }),
          Form({
            name: 'form',
            children: Field({ children: Input({ name: 'input' }) }),
          }),
        ],
      }),
    );
  });

  it('throws an error if the element type is not supported', () => {
    const nodeModels: NodeModel<JSXElement>[] = [
      {
        id: 1,
        parent: 0,
        text: 'parent',
        data: undefined,
      },
    ];

    expect(() => nodeModelsToComponent(nodeModels)).toThrow(
      'Node model must have data.',
    );
  });

  it('throws an error if the parent node is not found', () => {
    const nodeModels: NodeModel<JSXElement>[] = [
      {
        id: 1,
        parent: 2,
        text: 'parent',
        data: Input({ name: 'input' }),
      },
    ];

    expect(() => nodeModelsToComponent(nodeModels)).toThrow(
      'Root must be a box.',
    );
  });

  it('throws an error if the parent type is not supported', () => {
    const nodeModels: NodeModel<JSXElement>[] = [
      {
        id: 1,
        parent: 0,
        text: 'parent',
        data: Input({ name: 'input' }),
      },
      {
        id: 2,
        parent: 1,
        text: 'child',
        data: Box({ children: null }),
      },
    ];

    expect(() => nodeModelsToComponent(nodeModels)).toThrow(
      'Parent must be a box, form or field.',
    );
  });
});

describe('boxToCode', () => {
  it('creates code from a component', async () => {
    const component = Box({
      children: [
        Text({ children: 'foo' }),
        Box({
          children: [Text({ children: 'bar' }), Text({ children: 'baz' })],
        }),
      ],
    });

    const code = await boxToCode(component);
    expect(code).toMatchInlineSnapshot(`
      "import { Box, Text } from '@metamask/snaps-sdk/jsx';

      const Component = () => (
        <Box>
          <Text>foo</Text>
          <Box>
            <Text>bar</Text>
            <Text>baz</Text>
          </Box>
        </Box>
      );
      "
    `);
  });

  it('creates code from a component with a form', async () => {
    const component = Box({
      children: [
        Text({ children: 'foo' }),
        Form({
          name: 'form',
          children: [
            Field({
              children: [
                Input({ name: 'input' }),
                Button({ children: 'button' }),
              ],
            }),
          ],
        }),
      ],
    });

    const code = await boxToCode(component);
    expect(code).toMatchInlineSnapshot(`
      "import { Box, Button, Field, Form, Input, Text } from '@metamask/snaps-sdk/jsx';

      const Component = () => (
        <Box>
          <Text>foo</Text>
          <Form name="form">
            <Field>
              <Input name="input" />
              <Button>button</Button>
            </Field>
          </Form>
        </Box>
      );
      "
    `);
  });
});

describe('getNodeText', () => {
  it('returns the children of a node model', () => {
    const nodeModel: NodeModel<JSXElement> = {
      id: 1,
      parent: 0,
      text: 'foo',
      data: Text({ children: 'bar' }),
    };

    const nodeText = getNodeText(nodeModel);
    expect(nodeText).toBe('bar');
  });

  it('returns the value of a node model', () => {
    const nodeModel: NodeModel<JSXElement> = {
      id: 1,
      parent: 0,
      text: 'foo',
      data: Copyable({ value: 'bar' }),
    };

    const nodeText = getNodeText(nodeModel);
    expect(nodeText).toBe('bar');
  });

  it('returns null if the node model does not have text', () => {
    const nodeModel: NodeModel<JSXElement> = {
      id: 1,
      parent: 0,
      text: 'foo',
      // @ts-expect-error invalid data.
      data: { props: {} },
    };

    const nodeText = getNodeText(nodeModel);
    expect(nodeText).toBeNull();
  });
});

describe('canDropElement', () => {
  it('returns true if the element can be dropped in a Box', () => {
    const parent = Box({ children: null });
    const child = Text({ children: 'foo' });
    expect(canDropElement(parent, child)).toBe(true);
  });

  it('returns true if the element can be dropped in a Form', () => {
    const parent = Form({
      name: 'form',
      children: [Button({ children: 'Button' })],
    });
    const child = Field({ children: Input({ name: 'Input' }) });
    expect(canDropElement(parent, child)).toBe(true);
  });

  it('returns true if the element can be dropped in a Field', () => {
    const parent = Field({ children: Input({ name: 'Input' }) });
    const child = Button({ children: 'Button' });
    expect(canDropElement(parent, child)).toBe(true);
  });

  it('returns false if the element cannot be dropped', () => {
    const parent = Text({ children: 'foo' });
    const child = Text({ children: 'bar' });
    expect(canDropElement(parent, child)).toBe(false);
  });

  it('returns false if the parent or child is undefined', () => {
    const parent = undefined;
    const child = Text({ children: 'foo' });

    expect(canDropElement(parent, child)).toBe(false);

    const parent2 = Box({ children: null });
    const child2 = undefined;

    expect(canDropElement(parent2, child2)).toBe(false);
  });
});
