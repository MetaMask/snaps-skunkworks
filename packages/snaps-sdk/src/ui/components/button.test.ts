import { ButtonType, ButtonVariant, button } from './button';
import { NodeType } from '../nodes';

describe('button', () => {
  it('creates a button component', () => {
    expect(
      button({
        variant: ButtonVariant.Primary,
        value: 'Hello, world!',
        name: 'myButton',
        buttonType: ButtonType.Button,
      }),
    ).toStrictEqual({
      type: NodeType.Button,
      variant: ButtonVariant.Primary,
      buttonType: ButtonType.Button,
      name: 'myButton',
      value: 'Hello, world!',
    });

    expect(
      button({
        value: 'Hello, world!',
      }),
    ).toStrictEqual({
      type: NodeType.Button,
      value: 'Hello, world!',
    });
  });

  it('creates a button component using the shorthand form', () => {
    expect(
      button(
        'Hello, world!',
        ButtonType.Button,
        'myButton',
        ButtonVariant.Primary,
      ),
    ).toStrictEqual({
      type: NodeType.Button,
      value: 'Hello, world!',
      buttonType: ButtonType.Button,
      variant: ButtonVariant.Primary,
      name: 'myButton',
    });

    expect(button('foo bar')).toStrictEqual({
      type: NodeType.Button,
      value: 'foo bar',
    });
  });
});
