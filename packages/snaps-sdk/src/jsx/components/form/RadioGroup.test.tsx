import { Radio } from './Radio';
import { RadioGroup } from './RadioGroup';

describe('RadioGroup', () => {
  it('renders a set of radio options', () => {
    const result = (
      <RadioGroup name="radio-choice">
        <Radio value="A">Option A</Radio>
        <Radio value="B">Option B</Radio>
        <Radio value="C">Option C</Radio>
      </RadioGroup>
    );

    expect(result).toStrictEqual({
      type: 'RadioGroup',
      props: {
        name: 'radio-choice',
        children: [
          {
            type: 'Radio',
            key: null,
            props: {
              value: 'A',
              children: 'Option A',
            },
          },
          {
            type: 'Radio',
            key: null,
            props: {
              value: 'B',
              children: 'Option B',
            },
          },
          {
            type: 'Radio',
            key: null,
            props: {
              value: 'C',
              children: 'Option C',
            },
          },
        ],
      },
      key: null,
    });
  });

  it('renders a disabled Radio group', () => {
    const result = (
      <RadioGroup name="radio-choice" disabled={true}>
        <Radio value="A">Option A</Radio>
        <Radio value="B">Option B</Radio>
      </RadioGroup>
    );

    expect(result).toStrictEqual({
      type: 'RadioGroup',
      props: {
        name: 'radio-choice',
        disabled: true,
        children: [
          {
            type: 'Radio',
            key: null,
            props: {
              value: 'A',
              children: 'Option A',
            },
          },
          {
            type: 'Radio',
            key: null,
            props: {
              value: 'B',
              children: 'Option B',
            },
          },
        ],
      },
      key: null,
    });
  });
});
