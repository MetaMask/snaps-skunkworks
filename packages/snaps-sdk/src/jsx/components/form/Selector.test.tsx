import { Card } from '../Card';
import { Selector } from './Selector';
import { SelectorOption } from './SelectorOption';

describe('Selector', () => {
  it('renders a selector with options', () => {
    const result = (
      <Selector name="selector" value="foo" title="Choose an option">
        <SelectorOption value="foo">
          <Card title="Foo" value="$1" />
        </SelectorOption>
        <SelectorOption value="bar">
          <Card title="Bar" value="$1" />
        </SelectorOption>
      </Selector>
    );

    expect(result).toStrictEqual({
      type: 'Selector',
      props: {
        name: 'selector',
        value: 'foo',
        title: 'Choose an option',
        children: [
          {
            type: 'SelectorOption',
            props: {
              value: 'foo',
              children: {
                type: 'Card',
                props: {
                  title: 'Foo',
                  value: '$1',
                },
                key: null,
              },
            },
            key: null,
          },
          {
            type: 'SelectorOption',
            props: {
              value: 'bar',
              children: {
                type: 'Card',
                props: {
                  title: 'Bar',
                  value: '$1',
                },
                key: null,
              },
            },
            key: null,
          },
        ],
      },
      key: null,
    });
  });

  it('renders a selector with a conditional option', () => {
    const result = (
      <Selector name="selector" value="foo" title="Choose an option">
        <SelectorOption value="foo">
          <Card title="Foo" value="$1" />
        </SelectorOption>
        {false && (
          <SelectorOption value="bar">
            <Card title="Bar" value="$1" />
          </SelectorOption>
        )}
      </Selector>
    );

    expect(result).toStrictEqual({
      type: 'Selector',
      props: {
        name: 'selector',
        value: 'foo',
        title: 'Choose an option',
        children: [
          {
            type: 'SelectorOption',
            props: {
              value: 'foo',
              children: {
                type: 'Card',
                props: {
                  title: 'Foo',
                  value: '$1',
                },
                key: null,
              },
            },
            key: null,
          },
          false,
        ],
      },
      key: null,
    });
  });

  it('renders a disabled selector', () => {
    const result = (
      <Selector
        name="selector"
        value="foo"
        title="Choose an option"
        disabled={true}
      >
        <SelectorOption value="foo">
          <Card title="Foo" value="$1" />
        </SelectorOption>
      </Selector>
    );

    expect(result).toStrictEqual({
      type: 'Selector',
      props: {
        name: 'selector',
        value: 'foo',
        title: 'Choose an option',
        disabled: true,
        children: {
          type: 'SelectorOption',
          props: {
            value: 'foo',
            children: {
              type: 'Card',
              props: {
                title: 'Foo',
                value: '$1',
              },
              key: null,
            },
          },
          key: null,
        },
      },
      key: null,
    });
  });
});
