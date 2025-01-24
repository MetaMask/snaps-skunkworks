import { createSnapComponent } from '../../component';

/**
 * The props of the {@link Checkbox} component.
 *
 * @property name - The name of the checkbox. This is used to identify the
 * state in the form data.
 * @property checked - Whether the checkbox is checked or not.
 * @property label - An optional label for the checkbox.
 * @property variant - An optional variant for the checkbox.
 * @property disabled - Whether the Checkbox is disabled.
 */
export type CheckboxProps = {
  name: string;
  checked?: boolean | undefined;
  label?: string | undefined;
  variant?: 'default' | 'toggle' | undefined;
  disabled?: boolean | undefined;
};

const TYPE = 'Checkbox';

/**
 * A checkbox component, which is used to create a checkbox.
 *
 * @param props - The props of the component.
 * @param props.name - The name of the checkbox. This is used to identify the
 * state in the form data.
 * @param props.checked - Whether the checkbox is checked or not.
 * @param props.label - An optional label for the checkbox.
 * @param props.variant - An optional variant for the checkbox.
 * @param props.disabled - Whether the Checkbox is disabled.
 * @returns A checkbox element.
 * @example
 * <Checkbox name="accept-terms" />
 */
export const Checkbox = createSnapComponent<CheckboxProps, typeof TYPE>(TYPE);

/**
 * A checkbox element.
 *
 * @see Checkbox
 */
export type CheckboxElement = ReturnType<typeof Checkbox>;
