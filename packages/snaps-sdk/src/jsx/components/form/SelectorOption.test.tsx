import { Card } from '../Card';
import { SelectorOption } from './SelectorOption';

describe('Option', () => {
  it('renders a selector option', () => {
    const result = (
      <SelectorOption value="foo">
        <Card title="Foo" value="Bar" />
      </SelectorOption>
    );

    expect(result).toStrictEqual({
      type: 'SelectorOption',
      props: {
        value: 'foo',
        children: {
          type: 'Card',
          props: {
            title: 'Foo',
            value: 'Bar',
          },
          key: null,
        },
      },
      key: null,
    });
  });

  it('renders a disabled selector option', () => {
    const result = (
      <SelectorOption value="foo" disabled={true}>
        <Card title="Foo" value="Bar" />
      </SelectorOption>
    );

    expect(result).toStrictEqual({
      type: 'SelectorOption',
      props: {
        value: 'foo',
        disabled: true,
        children: {
          type: 'Card',
          props: {
            title: 'Foo',
            value: 'Bar',
          },
          key: null,
        },
      },
      key: null,
    });
  });
});
