import { Radio } from './Radio';

describe('Radio', () => {
  it('renders a radio option', () => {
    const result = <Radio value="foo">Foo</Radio>;

    expect(result).toStrictEqual({
      type: 'Radio',
      props: {
        value: 'foo',
        children: 'Foo',
      },
      key: null,
    });
  });

  it('renders a disabled radio option', () => {
    const result = (
      <Radio value="foo" disabled={true}>
        Foo
      </Radio>
    );

    expect(result).toStrictEqual({
      type: 'Radio',
      props: {
        value: 'foo',
        disabled: true,
        children: 'Foo',
      },
      key: null,
    });
  });
});
