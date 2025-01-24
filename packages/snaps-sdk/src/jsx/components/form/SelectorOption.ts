import { createSnapComponent } from '../../component';
import type { CardElement } from '../Card';

/**
 * The props of the {@link SelectorOption} component.
 *
 * @property value - The value of the selector option. This is used to populate the
 * state in the form data.
 * @property children - The component to display.
 * @property disabled - Whether the selector option is disabled.
 */
export type SelectorOptionProps = {
  value: string;
  children: CardElement;
  disabled?: boolean;
};

const TYPE = 'SelectorOption';

/**
 * A selector option component, which is used to create a selector option. This component
 * can only be used as a child of the {@link Selector} component.
 *
 * @param props - The props of the component.
 * @param props.value - The value of the selector option. This is used to populate the
 * state in the form data.
 * @param props.children - The component to display.
 * @param props.disabled - Whether the selector option is disabled.
 * @returns A selector option element.
 * @example
 * <Selector name="selector">
 *  <SelectorOption value="option1"><Card title="Option 1" value="Foo" /></SelectorOption>
 *  <SelectorOption value="option2"><Card title="Option 2" value="Bar" /></SelectorOption>
 *  <SelectorOption value="option3"><Card title="Option 3" value="Baz" /></SelectorOption>
 * </Selector>
 */
export const SelectorOption = createSnapComponent<
  SelectorOptionProps,
  typeof TYPE
>(TYPE);

/**
 * A selector option element.
 *
 * @see SelectorOption
 */
export type SelectorOptionElement = ReturnType<typeof SelectorOption>;
