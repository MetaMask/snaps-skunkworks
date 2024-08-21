import { assertIsComponent, isComponent } from './component';
import { ButtonVariant, ButtonType, InputType } from './components';
import type {
  Input,
  Form,
  type Button,
  type Divider,
  type Heading,
  type Image,
  type Panel,
  type Spinner,
  type Text,
} from './components';
import { NodeType } from './nodes';

describe('isComponent', () => {
  it('returns true for a divider component', () => {
    const divider: Divider = {
      type: NodeType.Divider,
    };

    expect(isComponent(divider)).toBe(true);
  });

  it('returns true for a heading component', () => {
    const heading: Heading = {
      type: NodeType.Heading,
      value: 'Hello, world!',
    };

    expect(isComponent(heading)).toBe(true);
  });

  it('returns true for a panel component', () => {
    const panel: Panel = {
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Heading,
          value: 'Hello, world!',
        },
      ],
    };

    expect(isComponent(panel)).toBe(true);
  });

  it('returns true for nested panels', () => {
    const panel: Panel = {
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
    };

    expect(isComponent(panel)).toBe(true);
  });

  it('returns true for a spinner component', () => {
    const spinner: Spinner = {
      type: NodeType.Spinner,
    };

    expect(isComponent(spinner)).toBe(true);
  });

  it('returns true for a text component', () => {
    const text: Text = {
      type: NodeType.Text,
      value: 'Hello, world!',
    };

    expect(isComponent(text)).toBe(true);
  });

  it('returns true for an image component', () => {
    const image: Image = {
      type: NodeType.Image,
      value: '<svg></svg>',
    };

    expect(isComponent(image)).toBe(true);
  });

  it('returns true for a button component', () => {
    const button: Button = {
      type: NodeType.Button,
      variant: ButtonVariant.Primary,
      buttonType: ButtonType.Button,
      name: 'myButton',
      value: 'Hello, world!',
    };

    expect(isComponent(button)).toBe(true);
  });

  it('returns true for a button component without optional fields', () => {
    const button: Button = {
      type: NodeType.Button,
      variant: undefined,
      buttonType: undefined,
      name: undefined,
      value: 'Hello, world!',
    };

    expect(isComponent(button)).toBe(true);
  });

  it('returns true for an input component', () => {
    const input: Input = {
      type: NodeType.Input,
      value: 'Hello, world!',
      name: 'myInput',
      inputType: InputType.Text,
      placeholder: 'Type here...',
      label: 'Hello',
    };

    expect(isComponent(input)).toBe(true);
  });

  it('returns true for an input component without optional fields', () => {
    const input: Input = {
      type: NodeType.Input,
      name: 'myInput',
      value: undefined,
      inputType: undefined,
      placeholder: undefined,
      label: undefined,
    };

    expect(isComponent(input)).toBe(true);
  });

  it('returns true for a form component', () => {
    const form: Form = {
      type: NodeType.Form,
      name: 'myForm',
      children: [
        {
          type: NodeType.Input,
          name: 'myInput',
          inputType: undefined,
          placeholder: undefined,
          value: undefined,
          label: undefined,
        },
      ],
    };

    expect(isComponent(form)).toBe(true);
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'Hello, world!',
    {},
    { type: NodeType.Heading },
    { type: NodeType.Heading, foo: 'bar' },
    { type: NodeType.Heading, text: 0 },
    { type: 'foo' },
  ])(`returns false for %p`, (value) => {
    expect(isComponent(value)).toBe(false);
  });
});

describe('assertIsComponent', () => {
  it('does not throw for a divider component', () => {
    const divider: Divider = {
      type: NodeType.Divider,
    };

    expect(() => assertIsComponent(divider)).not.toThrow();
  });

  it('does not throw for a heading component', () => {
    const heading: Heading = {
      type: NodeType.Heading,
      value: 'Hello, world!',
    };

    expect(() => assertIsComponent(heading)).not.toThrow();
  });

  it('does not throw for a panel component', () => {
    const panel: Panel = {
      type: NodeType.Panel,
      children: [
        {
          type: NodeType.Heading,
          value: 'Hello, world!',
        },
      ],
    };

    expect(() => assertIsComponent(panel)).not.toThrow();
  });

  it('does not throw for nested panels', () => {
    const panel: Panel = {
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
    };

    expect(() => assertIsComponent(panel)).not.toThrow();
  });

  it('does not throw for a spinner component', () => {
    const spinner: Spinner = {
      type: NodeType.Spinner,
    };

    expect(() => assertIsComponent(spinner)).not.toThrow();
  });

  it('does not throw for a text component', () => {
    const text: Text = {
      type: NodeType.Text,
      value: 'Hello, world!',
    };

    expect(() => assertIsComponent(text)).not.toThrow();
  });

  it('does not throw for a button component', () => {
    const button: Button = {
      type: NodeType.Button,
      variant: ButtonVariant.Primary,
      buttonType: ButtonType.Button,
      name: 'myButton',
      value: 'Hello, world!',
    };

    expect(() => assertIsComponent(button)).not.toThrow();
  });

  it('does not throw for a button component without optional fields', () => {
    const button: Button = {
      type: NodeType.Button,
      variant: undefined,
      buttonType: undefined,
      name: undefined,
      value: 'Hello, world!',
    };

    expect(() => assertIsComponent(button)).not.toThrow();
  });

  it('does not throw for an input component', () => {
    const input: Input = {
      type: NodeType.Input,
      value: 'Hello, world!',
      name: 'myInput',
      inputType: InputType.Text,
      placeholder: 'Type here...',
      label: 'Hello',
    };

    expect(() => assertIsComponent(input)).not.toThrow();
  });

  it('does not throw for an input component without optional fields', () => {
    const input: Input = {
      type: NodeType.Input,
      name: 'myInput',
      value: undefined,
      inputType: undefined,
      placeholder: undefined,
      label: undefined,
    };

    expect(() => assertIsComponent(input)).not.toThrow();
  });

  it('does not throw for a form component', () => {
    const form: Form = {
      type: NodeType.Form,
      name: 'myForm',
      children: [
        {
          type: NodeType.Input,
          name: 'myInput',
          inputType: undefined,
          placeholder: undefined,
          value: undefined,
          label: undefined,
        },
      ],
    };

    expect(isComponent(form)).toBe(true);
  });

  it.each([
    true,
    false,
    null,
    undefined,
    0,
    1,
    '',
    'Hello, world!',
    {},
    { type: NodeType.Heading },
    { type: NodeType.Heading, foo: 'bar' },
    { type: NodeType.Heading, text: 0 },
    { type: 'foo' },
  ])(`throws for %p`, (value) => {
    expect(() => assertIsComponent(value)).toThrow('Invalid component:');
  });
});
