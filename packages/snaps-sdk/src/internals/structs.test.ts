import { is, validate } from '@metamask/superstruct';

import { enumValue, literal, typedUnion, union } from './structs';
import { Text } from '../jsx';
import { BoxStruct, FieldStruct, TextStruct } from '../jsx/validation';

describe('enumValue', () => {
  it('validates an enum value', () => {
    enum Foo {
      Bar = 'bar',
      Baz = 'baz',
    }

    const struct = enumValue(Foo.Bar);

    expect(is('bar', struct)).toBe(true);
    expect(is('baz', struct)).toBe(false);
    expect(is(Foo.Bar, struct)).toBe(true);
    expect(is(Foo.Baz, struct)).toBe(false);
  });
});

describe('literal', () => {
  it.each(['foo', 42, true, false])('validates a literal value', (value) => {
    expect(is(value, literal(value))).toBe(true);
  });

  it('returns a struct with the correct name', () => {
    const [singleError] = validate('foo', literal('bar'));
    expect(singleError?.message).toBe(
      'Expected the literal `"bar"`, but received: "foo"',
    );

    const [unionError] = validate(
      'foo',
      union([literal('bar'), literal('baz')]),
    );
    expect(unionError?.message).toBe(
      'Expected the value to satisfy a union of `"bar" | "baz"`, but received: "foo"',
    );
  });
});

describe('typedUnion', () => {
  const unionStruct = typedUnion([BoxStruct, TextStruct, FieldStruct]);
  it('validates strictly the part of the union that matches the type', () => {
    // @ts-expect-error Invalid props.
    const result = validate(Text({}), unionStruct);

    expect(result[0]?.message).toBe(
      'At path: props.children -- Expected the value to satisfy a union of `union | array`, but received: undefined',
    );
  });

  it('returns an error if the value has no type', () => {
    const result = validate({}, unionStruct);

    expect(result[0]?.message).toBe(
      'Expected type to be one of: "Box", "Text", "Field", but received: undefined',
    );
  });

  it('returns an error if the type doesnt exist in the union', () => {
    const result = validate({ type: 'foo' }, unionStruct);

    expect(result[0]?.message).toBe(
      'Expected type to be one of: "Box", "Text", "Field", but received: "foo"',
    );
  });

  it('contains structs as part of the schema', () => {
    expect(unionStruct.schema).toStrictEqual([
      BoxStruct,
      TextStruct,
      FieldStruct,
    ]);
  });
});
