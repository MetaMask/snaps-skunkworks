import { createSnapComponent } from '../../component';

// TODO: Add the `onChange` prop to the `InputProps` type.

export type GenericInputProps = {
  name: string;
  value?: string | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
};

export type TextInputProps = { type: 'text' } & GenericInputProps;

export type PasswordInputProps = { type: 'password' } & GenericInputProps;

export type NumberInputProps = {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
} & GenericInputProps;

/**
 * The props of the {@link Input} component.
 *
 * @property name - The name of the input field. This is used to identify the
 * input field in the form data.
 * @property type - The type of the input field. Defaults to `text`.
 * @property value - The value of the input field.
 * @property placeholder - The placeholder text of the input field.
 * @property min - The minimum value of the input field.
 * Only applicable to the type `number` input.
 * @property max - The maximum value of the input field.
 * Only applicable to the type `number` input.
 * @property step - The step value of the input field.
 * Only applicable to the type `number` input.
 */
export type InputProps =
  | GenericInputProps
  | TextInputProps
  | PasswordInputProps
  | NumberInputProps;

const TYPE = 'Input';

/**
 * An input component, which is used to create an input field.
 *
 * @param props - The props of the component.
 * @param props.name - The name of the input field. This is used to identify the
 * input field in the form data.
 * @param props.type - The type of the input field.
 * @param props.value - The value of the input field.
 * @param props.placeholder - The placeholder text of the input field.
 * @param props.min - The minimum value of the input field.
 * Only applicable to the type `number` input.
 * @param props.max - The maximum value of the input field.
 * Only applicable to the type `number` input.
 * @param props.step - The step value of the input field.
 * Only applicable to the type `number` input.
 * @param props.disabled - Whether the input is disabled.
 * @returns An input element.
 * @example
 * <Input name="username" type="text" />
 * @example
 * <Input name="numeric" type="number" min={1} max={100} step={1} />
 */
export const Input = createSnapComponent<InputProps, typeof TYPE>(TYPE);

/**
 * An input element.
 *
 * @see Input
 */
export type InputElement = ReturnType<typeof Input>;
