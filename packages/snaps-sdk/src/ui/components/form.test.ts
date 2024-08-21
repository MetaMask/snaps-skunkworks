import { form } from './form';
import { input } from './input';
import { NodeType } from '../nodes';

describe('Form', () => {
  it('creates a form component', () => {
    expect(
      form({
        name: 'myForm',
        children: [input('myInput')],
      }),
    ).toStrictEqual({
      type: NodeType.Form,
      name: 'myForm',
      children: [
        {
          type: NodeType.Input,
          name: 'myInput',
        },
      ],
    });
  });

  it('creates a form component using the shorthand form', () => {
    expect(form('myForm', [input('myInput')])).toStrictEqual({
      type: NodeType.Form,
      name: 'myForm',
      children: [
        {
          type: NodeType.Input,
          name: 'myInput',
        },
      ],
    });
  });

  it('validates the args', () => {
    expect(() =>
      // @ts-expect-error - Invalid args.
      form({ name: 'foo', children: [input('myInput')], bar: 'baz' }),
    ).toThrow(
      'Invalid form component: At path: bar -- Expected a value of type `never`, but received: `"baz"`.',
    );

    // @ts-expect-error - Invalid args.
    expect(() => form({})).toThrow(
      'Invalid form component: At path: children -- Expected an array value, but received: undefined.',
    );
  });
});
