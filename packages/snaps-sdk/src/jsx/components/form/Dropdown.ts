import type { SnapsChildren } from '../../component';
import { createSnapComponent } from '../../component';
import type { OptionElement } from './Option';

/**
 * The props of the {@link Dropdown} component.
 *
 * @property name - The name of the dropdown. This is used to identify the
 * state in the form data.
 * @property value - The selected value of the dropdown.
 * @property children - The children of the dropdown.
 * @property disabled - Whether the Dropdown is disabled.
 */
export type DropdownProps = {
  name: string;
  value?: string | undefined;
  children: SnapsChildren<OptionElement>;
  disabled?: boolean | undefined;
};

const TYPE = 'Dropdown';

/**
 * A dropdown component, which is used to create a dropdown.
 *
 * @param props - The props of the component.
 * @param props.name - The name of the dropdown field. This is used to identify the
 * state in the form data.
 * @param props.value - The selected value of the dropdown.
 * @param props.children - The children of the dropdown.
 * @param props.disabled - Whether the Dropdown is disabled.
 * @returns A dropdown element.
 * @example
 * <Dropdown name="dropdown">
 *  <Option value="option1">Option 1</Option>
 *  <Option value="option2">Option 2</Option>
 *  <Option value="option3">Option 3</Option>
 * </Dropdown>
 */
export const Dropdown = createSnapComponent<DropdownProps, typeof TYPE>(TYPE);

/**
 * A dropdown element.
 *
 * @see Dropdown
 */
export type DropdownElement = ReturnType<typeof Dropdown>;
