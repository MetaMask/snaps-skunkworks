import type { StandardFormattingElement } from './formatting';
import type { IconElement } from './Icon';
import type { ImageElement } from './Image';
import type { LinkElement } from './Link';
import type { TextElement } from './Text';
import { createSnapComponent } from '../component';

export type TooltipChildren =
  | TextElement
  | StandardFormattingElement
  | LinkElement
  | ImageElement
  | IconElement
  | boolean
  | null;

/**
 * The props of the {@link Tooltip} component.
 *
 * @property children - The children of the box.
 * @property content - The text to display in the tooltip.
 */
export type TooltipProps = {
  children: TooltipChildren;
  content:
    | TextElement
    | StandardFormattingElement
    | LinkElement
    | IconElement
    | string;
};

const TYPE = 'Tooltip';

/**
 * A tooltip component, which is used to display text in a tooltip.
 *
 * @param props - The props of the component.
 * @param props.children - The children of the tooltip.
 * @param props.content - The text to display in the tooltip.
 * @returns A tooltip element.
 * @example
 * <Tooltip content="Tooltip text">
 *   <Text>Hello world!</Text>
 * </Tooltip>
 * @example
 * <Tooltip content={<Text>Text with <Bold>formatting</Bold></Text>}>
 *   <Text>Hello world!</Text>
 * </Tooltip>
 */
export const Tooltip = createSnapComponent<TooltipProps, typeof TYPE>(TYPE);

/**
 * A tooltip element.
 *
 * @see Tooltip
 */
export type TooltipElement = ReturnType<typeof Tooltip>;
