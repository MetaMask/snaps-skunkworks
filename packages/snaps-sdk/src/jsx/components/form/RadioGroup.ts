import type { SnapsChildren } from '../../component';
import { createSnapComponent } from '../../component';
import type { RadioElement } from './Radio';

const TYPE = 'RadioGroup';

/**
 * The props of the {@link RadioGroup} component.
 *
 * @property name - The name of the dropdown. This is used to identify the
 * state in the form data.
 * @property value - The value of the radio group element.
 * @property children - Radio options in form of <Radio> elements.
 * @property disabled - Whether the RadioGroup is disabled.
 */
type RadioGroupProps = {
  name: string;
  value?: string | undefined;
  children: SnapsChildren<RadioElement>;
  disabled?: boolean | undefined;
};

/**
 * A RadioGroup component, used to display multiple choices, where only one can be chosen.
 *
 * @returns A RadioGroup element.
 * @example
 * <RadioGroup />
 */
export const RadioGroup = createSnapComponent<RadioGroupProps, typeof TYPE>(
  TYPE,
);

/**
 * A RadioGroup element.
 *
 * @see RadioGroup
 */
export type RadioGroupElement = ReturnType<typeof RadioGroup>;
