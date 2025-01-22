import { createSnapComponent } from '../../component';

/**
 * The props of the {@link Radio} component.
 *
 * @property value - The value of the radio option. This is used to populate the
 * state in the form data.
 * @property children - The text to display.
 * @property disabled - Whether the Radio is disabled.
 */
type RadioProps = {
  value: string;
  children: string;
  disabled?: boolean | undefined;
};

const TYPE = 'Radio';

/**
 * A radio component, which is used to create a radio option. This component
 * can only be used as a child of the {@link RadioGroup} component.
 *
 * @param props - The props of the component.
 * @param props.value - The value of the radio option. This is used to populate the
 * state in the form data.
 * @param props.children - The text to display.
 * @param props.disabled - Whether the Radio is disabled.
 * @returns A radio element.
 * @example
 * <RadioGroup name="radio-group">
 *  <Radio value="option1">Option 1</Radio>
 *  <Radio value="option2">Option 2</Radio>
 *  <Radio value="option3">Option 3</Radio>
 * </RadioGroup>
 */
export const Radio = createSnapComponent<RadioProps, typeof TYPE>(TYPE);

/**
 * A radio element.
 *
 * @see Radio
 */
export type RadioElement = ReturnType<typeof Radio>;
