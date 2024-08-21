import type { ButtonElement } from './Button';
import type { CheckboxElement } from './Checkbox';
import type { DropdownElement } from './Dropdown';
import type { FileInputElement } from './FileInput';
import type { InputElement } from './Input';
import type { RadioGroupElement } from './RadioGroup';
import { createSnapComponent } from '../../component';

/**
 * The props of the {@link Field} component.
 *
 * @property label - The label of the field.
 * @property error - The error message of the field.
 * @property children - The input field and the submit button.
 */
export type FieldProps = {
  label?: string | undefined;
  error?: string | undefined;
  children:
    | [InputElement, ButtonElement]
    | DropdownElement
    | RadioGroupElement
    | FileInputElement
    | InputElement
    | CheckboxElement;
};

const TYPE = 'Field';

/**
 * A field component, which is used to create a form field. This component can
 * only be used as a child of the {@link Form} component.
 *
 * @param props - The props of the component.
 * @param props.label - The label of the field.
 * @param props.error - The error message of the field.
 * @param props.children - The input field and the submit button.
 * @returns A field element.
 * @example
 * <Field label="Username">
 *   <Input name="username" type="text" />
 *   <Button type="submit">Submit</Button>
 * </Field>
 * @example
 * <Field label="Upload file">
 *   <FileInput name="file" accept={['image/*']} multiple />
 * </Field>
 */
export const Field = createSnapComponent<FieldProps, typeof TYPE>(TYPE);

/**
 * A field element.
 *
 * @see Field
 */
export type FieldElement = ReturnType<typeof Field>;
