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
  refine,
  assign,
  union,
} from '@metamask/superstruct';
import {
  CaipAccountIdStruct,
  hasProperty,
  HexChecksumAddressStruct,
  isPlainObject,
  JsonStruct,
} from '@metamask/utils';

import type { Describe } from '../internals';
import {
  literal,
  nullUnion,
  selectiveUnion,
  svg,
  typedUnion,
} from '../internals';
import type { EmptyObject } from '../types';
import type {
  GenericSnapChildren,
  GenericSnapElement,
  JsonObject,
  Key,
  Nestable,
  SnapElement,
  SnapsChildren,
  StringElement,
} from './component';
import type { AvatarElement, SkeletonElement } from './components';
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
  type SectionElement,
  type SelectorElement,
  type SelectorOptionElement,
  type BannerElement,
  IconName,
} from './components';

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
  const nestableStruct: Struct<Nestable<Type>> = selectiveUnion((value) => {
    if (Array.isArray(value)) {
      return array(lazy(() => nestableStruct));
    }
    return struct;
  });

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
  return nestable(
    nullable(
      selectiveUnion((value) => {
        if (typeof value === 'boolean') {
          return boolean();
        }
        if (structs.length === 1) {
          return structs[0];
        }
        return nullUnion(structs);
      }),
    ),
  ) as unknown as Struct<
    Nestable<Infer<Head> | InferStructTuple<Tail>[number] | boolean | null>,
    null
  >;
}

/**
 * A helper function for creating a struct which allows a single child of a specific
 * type, as well as `null` and `boolean`.
 *
 * @param struct - The struct to allow as a single child.
 * @returns The struct for the children.
 */
function singleChild<Type extends AnyStruct>(
  struct: Type,
): Struct<Infer<Type> | boolean | null, null> {
  return nullable(
    selectiveUnion((value) => {
      if (typeof value === 'boolean') {
        return boolean();
      }

      return struct;
    }),
  ) as unknown as Struct<Infer<Type> | boolean | null, null>;
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
 * A helper function for creating a struct for a JSX element with selective props.
 *
 * @param name - The name of the element.
 * @param selector - The selector function choosing the struct to validate with.
 * @returns The struct for the element.
 */
function elementWithSelectiveProps<
  Name extends string,
  Selector extends (value: any) => AnyStruct,
>(name: Name, selector: Selector) {
  return object({
    type: literal(name) as unknown as Struct<Name, Name>,
    props: selectiveUnion(selector),
    key: nullable(KeyStruct),
  });
}

/**
 * Shared struct used to validate border radius values used by various Snaps components.
 */
export const BorderRadiusStruct = nullUnion([
  literal('none'),
  literal('medium'),
  literal('full'),
]);

/**
 * A struct for the {@link ImageElement} type.
 */
export const ImageStruct: Describe<ImageElement> = element('Image', {
  src: svg(),
  alt: optional(string()),
  borderRadius: optional(BorderRadiusStruct),
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
  size: optional(nullUnion([literal('sm'), literal('md')])),
  disabled: optional(boolean()),
  loading: optional(boolean()),
  form: optional(string()),
});

/**
 * A struct for the {@link CheckboxElement} type.
 */
export const CheckboxStruct: Describe<CheckboxElement> = element('Checkbox', {
  name: string(),
  checked: optional(boolean()),
  label: optional(string()),
  variant: optional(nullUnion([literal('default'), literal('toggle')])),
  disabled: optional(boolean()),
});

/**
 * A struct for the generic input element props.
 */
export const GenericInputPropsStruct = object({
  name: string(),
  value: optional(string()),
  placeholder: optional(string()),
  disabled: optional(boolean()),
});

/**
 * A struct for the text type input props.
 */
export const TextInputPropsStruct = assign(
  GenericInputPropsStruct,
  object({
    type: literal('text'),
  }),
);

/**
 * A struct for the password type input props.
 */
export const PasswordInputPropsStruct = assign(
  GenericInputPropsStruct,
  object({
    type: literal('password'),
  }),
);

/**
 * A struct for the number type input props.
 */
export const NumberInputPropsStruct = assign(
  GenericInputPropsStruct,
  object({
    type: literal('number'),
    min: optional(number()),
    max: optional(number()),
    step: optional(number()),
  }),
);

/**
 * A struct for the {@link InputElement} type.
 */
export const InputStruct: Describe<InputElement> = elementWithSelectiveProps(
  'Input',
  (value) => {
    if (isPlainObject(value) && hasProperty(value, 'type')) {
      switch (value.type) {
        case 'text':
          return TextInputPropsStruct;
        case 'password':
          return PasswordInputPropsStruct;
        case 'number':
          return NumberInputPropsStruct;
        default:
          return GenericInputPropsStruct;
      }
    }
    return GenericInputPropsStruct;
  },
);

/**
 * A struct for the {@link OptionElement} type.
 */
export const OptionStruct: Describe<OptionElement> = element('Option', {
  value: string(),
  children: string(),
  disabled: optional(boolean()),
});

/**
 * A struct for the {@link DropdownElement} type.
 */
export const DropdownStruct: Describe<DropdownElement> = element('Dropdown', {
  name: string(),
  value: optional(string()),
  children: children([OptionStruct]),
  disabled: optional(boolean()),
});

/**
 * A struct for the {@link AddressElement} type.
 */
export const AddressStruct: Describe<AddressElement> = element('Address', {
  address: nullUnion([HexChecksumAddressStruct, CaipAccountIdStruct]),
  truncate: optional(boolean()),
  displayName: optional(boolean()),
  avatar: optional(boolean()),
});

/**
 * A struct for the {@link CardElement} type.
 */
export const CardStruct: Describe<CardElement> = element('Card', {
  image: optional(string()),
  title: selectiveUnion((value) => {
    if (typeof value === 'object') {
      return AddressStruct;
    }
    return string();
  }),
  description: optional(string()),
  value: string(),
  extra: optional(string()),
});

/**
 * A struct for the {@link SelectorOptionElement} type.
 */
export const SelectorOptionStruct: Describe<SelectorOptionElement> = element(
  'SelectorOption',
  {
    value: string(),
    children: CardStruct,
    disabled: optional(boolean()),
  },
);

/**
 * A struct for the {@link SelectorElement} type.
 */
export const SelectorStruct: Describe<SelectorElement> = element('Selector', {
  name: string(),
  title: string(),
  value: optional(string()),
  children: children([SelectorOptionStruct]),
  disabled: optional(boolean()),
});

/**
 * A struct for the {@link RadioElement} type.
 */
export const RadioStruct: Describe<RadioElement> = element('Radio', {
  value: string(),
  children: string(),
  disabled: optional(boolean()),
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
    disabled: optional(boolean()),
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
    disabled: optional(boolean()),
  },
);

/**
 * A subset of JSX elements that represent the tuple Box + Input of the Field children.
 */
const BOX_INPUT_LEFT = [
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  singleChild(lazy(() => BoxChildStruct)),
  InputStruct,
] as [typeof BoxChildStruct, typeof InputStruct];

/**
 * A subset of JSX elements that represent the tuple Input + Box of the Field children.
 */
const BOX_INPUT_RIGHT = [
  InputStruct,
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  singleChild(lazy(() => BoxChildStruct)),
] as [typeof InputStruct, typeof BoxChildStruct];

/**
 * A subset of JSX elements that represent the tuple Box + Input + Box of the Field children.
 */
const BOX_INPUT_BOTH = [
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  singleChild(lazy(() => BoxChildStruct)),
  InputStruct,
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  singleChild(lazy(() => BoxChildStruct)),
] as [typeof BoxChildStruct, typeof InputStruct, typeof BoxChildStruct];

/**
 * A subset of JSX elements that are allowed as single children of the Field component.
 */
const FIELD_CHILDREN_ARRAY = [
  InputStruct,
  DropdownStruct,
  RadioGroupStruct,
  FileInputStruct,
  CheckboxStruct,
  SelectorStruct,
] as [
  typeof InputStruct,
  typeof DropdownStruct,
  typeof RadioGroupStruct,
  typeof FileInputStruct,
  typeof CheckboxStruct,
  typeof SelectorStruct,
];

/**
 * A union of the allowed children of the Field component.
 * This is mainly used in the simulator for validation purposes.
 */
export const FieldChildUnionStruct = nullUnion([
  ...FIELD_CHILDREN_ARRAY,
  ...BOX_INPUT_LEFT,
  ...BOX_INPUT_RIGHT,
  ...BOX_INPUT_BOTH,
]);

/**
 * A subset of JSX elements that are allowed as children of the Field component.
 */
const FieldChildStruct = selectiveUnion((value) => {
  const isArray = Array.isArray(value);
  if (isArray && value.length === 3) {
    return tuple(BOX_INPUT_BOTH);
  }

  if (isArray && value.length === 2) {
    return value[0]?.type === 'Box'
      ? tuple(BOX_INPUT_LEFT)
      : tuple(BOX_INPUT_RIGHT);
  }

  return typedUnion(FIELD_CHILDREN_ARRAY);
}) as unknown as Struct<
  | [InputElement, GenericSnapChildren]
  | [GenericSnapChildren, InputElement]
  | [GenericSnapChildren, InputElement, GenericSnapChildren]
  | DropdownElement
  | RadioGroupElement
  | FileInputElement
  | InputElement
  | CheckboxElement
  | SelectorElement,
  null
>;

/**
 * A struct for the {@link FieldElement} type.
 */
export const FieldStruct: Describe<FieldElement> = element('Field', {
  label: optional(string()),
  error: optional(string()),
  children: FieldChildStruct,
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

export const FormattingStruct: Describe<StandardFormattingElement> = typedUnion(
  [BoldStruct, ItalicStruct],
);

/**
 * A struct for the {@link AvatarElement} type.
 */
export const AvatarStruct = element('Avatar', {
  address: CaipAccountIdStruct,
  size: optional(nullUnion([literal('sm'), literal('md'), literal('lg')])),
}) as unknown as Struct<AvatarElement, null>;

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
  center: optional(boolean()),
});

/**
 * A subset of JSX elements that are allowed as children of the Form component.
 */
export const FormChildStruct = BoxChildrenStruct;

/**
 * A struct for the {@link FormElement} type.
 */
export const FormStruct: Describe<FormElement> = element('Form', {
  children: FormChildStruct,
  name: string(),
});

const FooterButtonStruct = refine(ButtonStruct, 'FooterButton', (value) => {
  if (
    typeof value.props.children === 'string' ||
    typeof value.props.children === 'boolean' ||
    value.props.children === null
  ) {
    return true;
  }

  if (Array.isArray(value.props.children)) {
    const hasNonTextElements = value.props.children.some(
      (child) =>
        typeof child !== 'string' &&
        typeof child !== 'boolean' &&
        child !== null,
    );

    if (!hasNonTextElements) {
      return true;
    }
  }

  return 'Footer buttons may only contain text.';
});

/**
 * A struct for the {@link SectionElement} type.
 */
export const SectionStruct: Describe<SectionElement> = element('Section', {
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

export const FooterChildStruct = selectiveUnion((value) => {
  if (Array.isArray(value)) {
    return tuple([FooterButtonStruct, FooterButtonStruct]);
  }
  return FooterButtonStruct;
});

/**
 * A struct for the {@link FooterElement} type.
 */
export const FooterStruct: Describe<FooterElement> = element('Footer', {
  children: FooterChildStruct,
  requireScroll: optional(boolean()),
});

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
 * A struct for the {@link HeadingElement} type.
 */
export const HeadingStruct: Describe<HeadingElement> = element('Heading', {
  children: StringElementStruct,
  size: optional(nullUnion([literal('sm'), literal('md'), literal('lg')])),
});

/**
 * A struct for the {@link LinkElement} type.
 */
export const LinkStruct: Describe<LinkElement> = element('Link', {
  href: string(),
  children: children([
    FormattingStruct,
    string(),
    IconStruct,
    ImageStruct,
    AddressStruct,
  ]),
});

/**
 * A struct for the {@link SkeletonElement} type.
 */
export const SkeletonStruct: Describe<SkeletonElement> = element('Skeleton', {
  width: optional(union([number(), string()])),
  height: optional(union([number(), string()])),
  borderRadius: optional(BorderRadiusStruct),
});

/**
 * A struct for the {@link TextElement} type.
 */
export const TextStruct: Describe<TextElement> = element('Text', {
  children: children([
    selectiveUnion((value) => {
      if (typeof value === 'string') {
        return string();
      }
      return typedUnion([
        BoldStruct,
        ItalicStruct,
        LinkStruct,
        IconStruct,
        SkeletonStruct,
      ]);
    }),
  ]),
  alignment: optional(
    nullUnion([literal('start'), literal('center'), literal('end')]),
  ),
  color: optional(
    nullUnion([
      literal('default'),
      literal('alternative'),
      literal('muted'),
      literal('error'),
      literal('success'),
      literal('warning'),
    ]),
  ),
  size: optional(nullUnion([literal('sm'), literal('md')])),
  fontWeight: optional(
    nullUnion([literal('regular'), literal('medium'), literal('bold')]),
  ),
});

/**
 * A struct for the {@link ValueElement} type.
 */
export const ValueStruct: Describe<ValueElement> = element('Value', {
  value: selectiveUnion((value) => {
    if (typeof value === 'string') {
      return string();
    }

    return TextStruct;
  }),
  extra: selectiveUnion((value) => {
    if (typeof value === 'string') {
      return string();
    }

    return TextStruct;
  }),
});

/**
 * A subset of JSX elements that are allowed as children of the Tooltip component.
 * This set should include all text components and the Image.
 */
export const TooltipChildStruct = selectiveUnion((value) => {
  if (typeof value === 'boolean') {
    return boolean();
  }
  return typedUnion([
    TextStruct,
    BoldStruct,
    ItalicStruct,
    LinkStruct,
    ImageStruct,
    IconStruct,
  ]);
});

/**
 * A subset of JSX elements that are allowed as content of the Tooltip component.
 * This set should include all text components.
 */
export const TooltipContentStruct = selectiveUnion((value) => {
  if (typeof value === 'string') {
    return string();
  }
  return typedUnion([
    TextStruct,
    BoldStruct,
    ItalicStruct,
    LinkStruct,
    IconStruct,
  ]);
});

/**
 * A struct for the {@link TooltipElement} type.
 */
export const TooltipStruct: Describe<TooltipElement> = element('Tooltip', {
  children: nullable(TooltipChildStruct),
  content: TooltipContentStruct,
});

/**
 * A struct for the {@link BannerElement} type.
 */
export const BannerStruct: Describe<BannerElement> = element('Banner', {
  children: children([
    TextStruct,
    LinkStruct,
    IconStruct,
    ButtonStruct,
    BoldStruct,
    ItalicStruct,
    SkeletonStruct,
  ]),
  title: string(),
  severity: union([
    literal('danger'),
    literal('info'),
    literal('success'),
    literal('warning'),
  ]),
});

/**
 * A struct for the {@link RowElement} type.
 */
export const RowStruct: Describe<RowElement> = element('Row', {
  label: string(),
  children: typedUnion([
    AddressStruct,
    ImageStruct,
    TextStruct,
    ValueStruct,
    LinkStruct,
    SkeletonStruct,
  ]),
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
  FieldStruct,
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
  SelectorStruct,
  SectionStruct,
  AvatarStruct,
  BannerStruct,
  SkeletonStruct,
]);

/**
 * A struct for the {@link ContainerElement} type.
 */
export const ContainerStruct: Describe<ContainerElement> = element(
  'Container',
  {
    children: selectiveUnion((value) => {
      if (Array.isArray(value)) {
        return tuple([BoxChildStruct, FooterStruct]);
      }
      return BoxChildStruct;
    }) as unknown as Struct<
      [GenericSnapElement, FooterElement] | GenericSnapElement,
      null
    >,
    backgroundColor: optional(
      nullUnion([literal('default'), literal('alternative')]),
    ),
  },
);

/**
 * For now, the allowed JSX elements at the root are the same as the allowed
 * children of the Box component.
 */
export const RootJSXElementStruct = typedUnion([
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
  SelectorStruct,
  SelectorOptionStruct,
  SectionStruct,
  AvatarStruct,
  BannerStruct,
  SkeletonStruct,
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
