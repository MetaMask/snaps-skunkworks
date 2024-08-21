import type { AddressElement } from './Address';
import type { ImageElement } from './Image';
import type { TextElement } from './Text';
import type { ValueElement } from './Value';
import { createSnapComponent } from '../component';

/**
 * The children of a {@link Row} component.
 */
export type RowChildren =
  | AddressElement
  | ImageElement
  | TextElement
  | ValueElement;

/**
 * The props of the {@link Row} component.
 *
 * @property label - The label of the row.
 * @property children - The content of the row. This can be an address, an
 * image, or text.
 * @property variant - The variant of the row.
 * @property tooltip - An optional tooltip to show for the row.
 */
export type RowProps = {
  label: string;
  children: RowChildren;
  variant?: 'default' | 'warning' | 'critical' | undefined;
  tooltip?: string | undefined;
};

const TYPE = 'Row';

/**
 * A row component, which is used to display a row of information.
 *
 * @param props - The props of the component.
 * @param props.label - The label of the row.
 * @param props.children - The content of the row. This can be an address, an
 * image, or text.
 * @param props.variant - The variant of the row.
 * @param props.tooltip - An optional tooltip to show for the row.
 * @returns A row element.
 * @example
 * <Row label="From" variant="warning" tooltip="This address has been deemed dangerous.">
 *   <Address address="0x1234567890123456789012345678901234567890" />
 * </Row>
 */
export const Row = createSnapComponent<RowProps, typeof TYPE>(TYPE);

/**
 * A row element.
 *
 * @see Row
 */
export type RowElement = ReturnType<typeof Row>;
