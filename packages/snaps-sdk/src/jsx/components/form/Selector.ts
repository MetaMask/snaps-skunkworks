import type { SnapsChildren } from '../../component';
import { createSnapComponent } from '../../component';
import type { SelectorOptionElement } from './SelectorOption';

/**
 * The props of the {@link Selector} component.
 *
 * @property name - The name of the selector. This is used to identify the
 * state in the form data.
 * @property title - The title of the selector. This is displayed in the UI.
 * @property value - The selected value of the selector.
 * @property children - The children of the selector.
 * @property disabled - Whether the Selector is disabled.
 */
export type SelectorProps = {
  name: string;
  title: string;
  value?: string | undefined;
  children: SnapsChildren<SelectorOptionElement>;
  disabled?: boolean | undefined;
};

const TYPE = 'Selector';

/**
 * A selector component, which is used to create a selector.
 *
 * @param props - The props of the component.
 * @param props.name - The name of the selector field. This is used to identify the
 * state in the form data.
 * @param props.title - The title of the selector field. This is displayed in the UI.
 * @param props.value - The selected value of the selector.
 * @param props.children - The children of the selector.
 * @property disabled - Whether the Selector is disabled.
 * @returns A selector element.
 * @example
 * <Selector name="selector">
 *  <SelectorOption value="option1"><Card title="Option 1" value="Foo" /></SelectorOption>
 *  <SelectorOption value="option2"><Card title="Option 2" value="Bar" /></SelectorOption>
 *  <SelectorOption value="option3"><Card title="Option 3" value="Baz" /></SelectorOption>
 * </Selector>
 */
export const Selector = createSnapComponent<SelectorProps, typeof TYPE>(TYPE);

/**
 * A selector element.
 *
 * @see Selector
 */
export type SelectorElement = ReturnType<typeof Selector>;
