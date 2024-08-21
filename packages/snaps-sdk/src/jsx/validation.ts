import type {
  AnyStruct,
  Infer,
  InferStructTuple,
  ObjectSchema,
  Struct,
} from '@metamask/superstruct';
import {
  is,
  boolean,
  optional,
  array,
  lazy,
  nullable,
  number,
  object,
  record,
  string,
  tuple,
} from '@metamask/superstruct';
import {
  hasProperty,
  HexChecksumAddressStruct,
  isPlainObject,
  JsonStruct,
} from '@metamask/utils';

import type {
  GenericSnapElement,
  JsonObject,
  Key,
  Nestable,
  SnapElement,
  SnapsChildren,
  StringElement,
} from './component';
import {
  type AddressElement,
  type BoldElement,
  type BoxElement,
  type ButtonElement,
  type CheckboxElement,
  type CardElement,
  type CopyableElement,
  type DividerElement,
  type DropdownElement,
  type OptionElement,
  type RadioElement,
  type RadioGroupElement,
  type FieldElement,
  type FormElement,
  type HeadingElement,
  type ImageElement,
  type InputElement,
  type ItalicElement,
  type JSXElement,
  type LinkElement,
  type RowElement,
  type SpinnerElement,
  type StandardFormattingElement,
  type TextElement,
  type TooltipElement,
  type ValueElement,
  type FileInputElement,
  type ContainerElement,
  type FooterElement,
  type IconElement,
  IconName,
} from './components';
import type { Describe } from '../internals';
import { literal, nullUnion, svg, typedUnion } from '../internals';
import type { EmptyObject } from '../types';

/**
 * A struct for the {@link Key} type.
 */
export const KeyStruct: Describe<Key> = nullUnion([string(), number()]);

/**
 * A struct for the {@link StringElement} type.
 */
export const StringElementStruct: Describe<StringElement> = children([
  string(),
]);

/**
 * A struct for the {@link GenericSnapElement} type.
 */
export const ElementStruct: Describe<GenericSnapElement> = object({
  type: string(),
  props: record(string(), JsonStruct),
  key: nullable(KeyStruct),
});

/**
 * A helper function for creating a struct for a {@link Nestable} type.
 *
 * @param struct - The struct for the type to test.
 * @returns The struct for the nestable type.
 */
function nestable<Type, Schema>(
  struct: Struct<Type, Schema>,
): Struct<Nestable<Type>, any> {
  const nestableStruct: Struct<Nestable<Type>> = nullUnion([
    struct,
    array(lazy(() => nestableStruct)),
  ]);

  return nestableStruct;
}

/**
 * A helper function for creating a struct which allows children of a specific
 * type, as well as `null` and `boolean`.
 *
 * @param structs - The structs to allow as children.
 * @returns The struct for the children.
 */
function children<Head extends AnyStruct, Tail extends AnyStruct[]>(
  structs: [head: Head, ...tail: Tail],
): Struct<
  Nestable<Infer<Head> | InferStructTuple<Tail>[number] | boolean | null>,
  null
> {
  return nestable(nullable(nullUnion([...structs, boolean()])));
}

/**
 * A helper function for creating a struct for a JSX element.
 *
 * @param name - The name of the element.
 * @param props - The props of the element.
 * @returns The struct for the element.
 */
function element<Name extends string, Props extends ObjectSchema = EmptyObject>(
  name: Name,
  props: Props = {} as Props,
) {
  return object({
    type: literal(name) as unknown as Struct<Name, Name>,
    props: object(props),
    key: nullable(KeyStruct),
  });
}

/**
 * A struct for the {@link ImageElement} type.
 */
export const ImageStruct: Describe<ImageElement> = element('Image', {
  src: svg(),
  alt: optional(string()),
});

const IconNameStruct: Struct<`${IconName}`, null> = nullUnion(
  Object.values(IconName).map((name) => literal(name)) as any,
);

/**
 * A struct for the {@link IconElement} type.
 */
export const IconStruct: Describe<IconElement> = element('Icon', {
  name: IconNameStruct,
  color: optional(
    nullUnion([literal('default'), literal('primary'), literal('muted')]),
  ),
  size: optional(nullUnion([literal('md'), literal('inherit')])),
});

/**
 * A struct for the {@link ButtonElement} type.
 */
export const ButtonStruct: Describe<ButtonElement> = element('Button', {
  children: children([StringElementStruct, ImageStruct, IconStruct]),
  name: optional(string()),
  type: optional(nullUnion([literal('button'), literal('submit')])),
  variant: optional(nullUnion([literal('primary'), literal('destructive')])),
  disabled: optional(boolean()),
});

/**
 * A struct for the {@link CheckboxElement} type.
 */
export const CheckboxStruct: Describe<CheckboxElement> = element('Checkbox', {
  name: string(),
  checked: optional(boolean()),
  label: optional(string()),
  variant: optional(nullUnion([literal('default'), literal('toggle')])),
});

/**
 * A struct for the {@link InputElement} type.
 */
export const InputStruct: Describe<InputElement> = element('Input', {
  name: string(),
  type: optional(
    nullUnion([literal('text'), literal('password'), literal('number')]),
  ),
  value: optional(string()),
  placeholder: optional(string()),
});

/**
 * A struct for the {@link OptionElement} type.
 */
export const OptionStruct: Describe<OptionElement> = element('Option', {
  value: string(),
  children: string(),
});

/**
 * A struct for the {@link DropdownElement} type.
 */
export const DropdownStruct: Describe<DropdownElement> = element('Dropdown', {
  name: string(),
  value: optional(string()),
  children: children([OptionStruct]),
});

/**
 * A struct for the {@link RadioElement} type.
 */
export const RadioStruct: Describe<RadioElement> = element('Radio', {
  value: string(),
  children: string(),
});

/**
 * A struct for the {@link RadioGroupElement} type.
 */
export const RadioGroupStruct: Describe<RadioGroupElement> = element(
  'RadioGroup',
  {
    name: string(),
    value: optional(string()),
    children: children([RadioStruct]),
  },
);

/**
 * A struct for the {@link FileInputElement} type.
 */
export const FileInputStruct: Describe<FileInputElement> = element(
  'FileInput',
  {
    name: string(),
    accept: nullUnion([optional(array(string()))]),
    compact: optional(boolean()),
  },
);

/**
 * A subset of JSX elements that represent the tuple Button + Input of the Field children.
 */
const BUTTON_INPUT = [InputStruct, ButtonStruct] as [
  typeof InputStruct,
  typeof ButtonStruct,
];

/**
 * A subset of JSX elements that are allowed as single children of the Field component.
 */
const FIELD_CHILDREN_ARRAY = [
  InputStruct,
  DropdownStruct,
  RadioGroupStruct,
  FileInputStruct,
  CheckboxStruct,
] as [
  typeof InputStruct,
  typeof DropdownStruct,
  typeof RadioGroupStruct,
  typeof FileInputStruct,
  typeof CheckboxStruct,
];

/**
 * A union of the allowed children of the Field component.
 * This is mainly used in the simulator for validation purposes.
 */
export const FieldChildUnionStruct = nullUnion([
  ...FIELD_CHILDREN_ARRAY,
  ...BUTTON_INPUT,
]);

/**
 * A subset of JSX elements that are allowed as children of the Field component.
 */
const FieldChildStruct = nullUnion([
  tuple(BUTTON_INPUT),
  ...FIELD_CHILDREN_ARRAY,
]);

/**
 * A struct for the {@link FieldElement} type.
 */
export const FieldStruct: Describe<FieldElement> = element('Field', {
  label: optional(string()),
  error: optional(string()),
  children: FieldChildStruct,
});

/**
 * A subset of JSX elements that are allowed as children of the Form component.
 */
export const FormChildStruct = children(
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  [FieldStruct, lazy(() => BoxChildStruct)],
) as unknown as Struct<SnapsChildren<GenericSnapElement>, null>;

/**
 * A struct for the {@link FormElement} type.
 */
export const FormStruct: Describe<FormElement> = element('Form', {
  children: FormChildStruct,
  name: string(),
});

/**
 * A struct for the {@link BoldElement} type.
 */
export const BoldStruct: Describe<BoldElement> = element('Bold', {
  children: children([
    string(),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    lazy(() => ItalicStruct) as unknown as Struct<
      SnapElement<JsonObject, 'Italic'>
    >,
  ]),
});

/**
 * A struct for the {@link ItalicElement} type.
 */
export const ItalicStruct: Describe<ItalicElement> = element('Italic', {
  children: children([
    string(),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    lazy(() => BoldStruct) as unknown as Struct<
      SnapElement<JsonObject, 'Bold'>
    >,
  ]),
});

export const FormattingStruct: Describe<StandardFormattingElement> = nullUnion([
  BoldStruct,
  ItalicStruct,
]);

/**
 * A struct for the {@link AddressElement} type.
 */
export const AddressStruct: Describe<AddressElement> = element('Address', {
  address: HexChecksumAddressStruct,
});

export const BoxChildrenStruct = children(
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  [lazy(() => BoxChildStruct)],
) as unknown as Struct<SnapsChildren<GenericSnapElement>, null>;

/**
 * A struct for the {@link BoxElement} type.
 */
export const BoxStruct: Describe<BoxElement> = element('Box', {
  children: BoxChildrenStruct,
  direction: optional(nullUnion([literal('horizontal'), literal('vertical')])),
  alignment: optional(
    nullUnion([
      literal('start'),
      literal('center'),
      literal('end'),
      literal('space-between'),
      literal('space-around'),
    ]),
  ),
});

/**
 * A subset of JSX elements that are allowed as children of the Footer component.
 * This set should include a single button or a tuple of two buttons.
 */
export const FooterChildStruct = nullUnion([
  tuple([ButtonStruct, ButtonStruct]),
  ButtonStruct,
]);

/**
 * A struct for the {@link FooterElement} type.
 */
export const FooterStruct: Describe<FooterElement> = element('Footer', {
  children: FooterChildStruct,
});

/**
 * A subset of JSX elements that are allowed as children of the Container component.
 * This set should include a single Box or a tuple of a Box and a Footer component.
 */
export const ContainerChildStruct = nullUnion([
  tuple([BoxStruct, FooterStruct]),
  BoxStruct,
]);

/**
 * A struct for the {@link ContainerElement} type.
 */
export const ContainerStruct: Describe<ContainerElement> = element(
  'Container',
  {
    children: ContainerChildStruct,
  },
);

/**
 * A struct for the {@link CopyableElement} type.
 */
export const CopyableStruct: Describe<CopyableElement> = element('Copyable', {
  value: string(),
  sensitive: optional(boolean()),
});

/**
 * A struct for the {@link DividerElement} type.
 */
export const DividerStruct: Describe<DividerElement> = element('Divider');

/**
 * A struct for the {@link ValueElement} type.
 */
export const ValueStruct: Describe<ValueElement> = element('Value', {
  value: string(),
  extra: string(),
});

/**
 * A struct for the {@link CardElement} type.
 */
export const CardStruct: Describe<CardElement> = element('Card', {
  image: optional(string()),
  title: string(),
  description: optional(string()),
  value: string(),
  extra: optional(string()),
});

/**
 * A struct for the {@link HeadingElement} type.
 */
export const HeadingStruct: Describe<HeadingElement> = element('Heading', {
  children: StringElementStruct,
});

/**
 * A struct for the {@link LinkElement} type.
 */
export const LinkStruct: Describe<LinkElement> = element('Link', {
  href: string(),
  children: children([FormattingStruct, string()]),
});

/**
 * A struct for the {@link TextElement} type.
 */
export const TextStruct: Describe<TextElement> = element('Text', {
  children: children([
    string(),
    BoldStruct,
    ItalicStruct,
    LinkStruct,
    IconStruct,
  ]),
  alignment: optional(
    nullUnion([literal('start'), literal('center'), literal('end')]),
  ),
});

/**
 * A subset of JSX elements that are allowed as children of the Tooltip component.
 * This set should include all text components and the Image.
 */
export const TooltipChildStruct = nullUnion([
  TextStruct,
  BoldStruct,
  ItalicStruct,
  LinkStruct,
  ImageStruct,
  IconStruct,
  boolean(),
]);

/**
 * A subset of JSX elements that are allowed as content of the Tooltip component.
 * This set should include all text components.
 */
export const TooltipContentStruct = nullUnion([
  TextStruct,
  BoldStruct,
  ItalicStruct,
  LinkStruct,
  IconStruct,
  string(),
]);

/**
 * A struct for the {@link TooltipElement} type.
 */
export const TooltipStruct: Describe<TooltipElement> = element('Tooltip', {
  children: nullable(TooltipChildStruct),
  content: TooltipContentStruct,
});

/**
 * A struct for the {@link RowElement} type.
 */
export const RowStruct: Describe<RowElement> = element('Row', {
  label: string(),
  children: nullUnion([AddressStruct, ImageStruct, TextStruct, ValueStruct]),
  variant: optional(
    nullUnion([literal('default'), literal('warning'), literal('critical')]),
  ),
  tooltip: optional(string()),
});

/**
 * A struct for the {@link SpinnerElement} type.
 */
export const SpinnerStruct: Describe<SpinnerElement> = element('Spinner');

/**
 * A subset of JSX elements that are allowed as children of the Box component.
 * This set includes all components, except components that need to be nested in
 * another component (e.g., Field must be contained in a Form).
 */
export const BoxChildStruct = typedUnion([
  AddressStruct,
  BoldStruct,
  BoxStruct,
  ButtonStruct,
  CopyableStruct,
  DividerStruct,
  DropdownStruct,
  RadioGroupStruct,
  FileInputStruct,
  FormStruct,
  HeadingStruct,
  InputStruct,
  ImageStruct,
  ItalicStruct,
  LinkStruct,
  RowStruct,
  SpinnerStruct,
  TextStruct,
  TooltipStruct,
  CheckboxStruct,
  CardStruct,
  IconStruct,
]);

/**
 * For now, the allowed JSX elements at the root are the same as the allowed
 * children of the Box component.
 */
export const RootJSXElementStruct = nullUnion([
  BoxChildStruct,
  ContainerStruct,
]);

/**
 * A struct for the {@link JSXElement} type.
 */
export const JSXElementStruct: Describe<JSXElement> = typedUnion([
  ButtonStruct,
  InputStruct,
  FileInputStruct,
  FieldStruct,
  FormStruct,
  BoldStruct,
  ItalicStruct,
  AddressStruct,
  BoxStruct,
  CopyableStruct,
  DividerStruct,
  HeadingStruct,
  ImageStruct,
  LinkStruct,
  RowStruct,
  SpinnerStruct,
  TextStruct,
  DropdownStruct,
  OptionStruct,
  RadioGroupStruct,
  RadioStruct,
  ValueStruct,
  TooltipStruct,
  CheckboxStruct,
  FooterStruct,
  ContainerStruct,
  CardStruct,
  IconStruct,
]);

/**
 * Check if a value is a JSX element.
 *
 * @param value - The value to check.
 * @returns True if the value is a JSX element, false otherwise.
 */
export function isJSXElement(value: unknown): value is JSXElement {
  return is(value, JSXElementStruct);
}

/**
 * Check if a value is a JSX element, without validating all of its contents.
 * This is useful when you want to validate the structure of a value, but not
 * all the children.
 *
 * This should only be used when you are sure that the value is safe to use,
 * i.e., after using {@link isJSXElement}.
 *
 * @param value - The value to check.
 * @returns True if the value is a JSX element, false otherwise.
 */
export function isJSXElementUnsafe(value: unknown): value is JSXElement {
  return (
    isPlainObject(value) &&
    hasProperty(value, 'type') &&
    hasProperty(value, 'props') &&
    hasProperty(value, 'key')
  );
}

/**
 * Assert that a value is a JSX element.
 *
 * @param value - The value to check.
 * @throws If the value is not a JSX element.
 */
export function assertJSXElement(value: unknown): asserts value is JSXElement {
  // TODO: We should use the error parsing utils from `snaps-utils` to improve
  // the error messages. It currently includes colours and potentially other
  // formatting that we might not want to include in the SDK.
  if (!isJSXElement(value)) {
    throw new Error(
      `Expected a JSX element, but received ${JSON.stringify(
        value,
      )}. Please refer to the documentation for the supported JSX elements and their props.`,
    );
  }
}
