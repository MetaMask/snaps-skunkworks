import type { Infer } from '@metamask/superstruct';
import {
  assign,
  literal,
  object,
  string,
  optional,
  union,
} from '@metamask/superstruct';

import { AddressStruct } from './address';
import { ImageStruct } from './image';
import { TextStruct } from './text';
import { enumValue } from '../../internals';
import { createBuilder } from '../builder';
import { LiteralStruct, NodeType } from '../nodes';

export enum RowVariant {
  Default = 'default',
  Critical = 'critical',
  Warning = 'warning',
}

// A subset of components made available to the row
const RowComponentStruct = union([ImageStruct, TextStruct, AddressStruct]);

export const RowStruct = assign(
  LiteralStruct,
  object({
    type: literal(NodeType.Row),
    variant: optional(
      union([
        enumValue(RowVariant.Default),
        enumValue(RowVariant.Critical),
        enumValue(RowVariant.Warning),
      ]),
    ),
    label: string(),
    value: RowComponentStruct,
  }),
);

/**
 * A row node, that renders a row with a label and a value.
 *
 * @property type - The type of the node. Must be the string `row`.
 * @property label - The label for the row.
 * @property value - A sub component to be rendered
 * on one side of the row.
 * @property variant - Optional variant for styling.
 */
export type Row = Infer<typeof RowStruct>;

/**
 * Create a {@link Row} node.
 *
 * @param args - The node arguments. This can either be a string, a component and an optional variant or an object
 * with the properties: `label`, `value` and `variant`.
 * @param args.label - The label for the row.
 * @param args.value - Another component, is currently limited to `image`, `text` and `address`.
 * @param args.variant - An optional variant, either `default`, `warning` or `critical`.
 * @returns The row node as an object.
 * @deprecated Snaps component functions are deprecated, in favor of the new JSX
 * components. This function will be removed in a future release.
 * @example
 * const node = row({ label: 'Address', value: address('0x4bbeeb066ed09b7aed07bf39eee0460dfa261520') });
 * const node = row({ label: 'Address', value: address('0x4bbeeb066ed09b7aed07bf39eee0460dfa261520'), variant: RowVariant.Warning });
 * const node = row('Address', address('0x4bbeeb066ed09b7aed07bf39eee0460dfa261520'));
 * const node = row('Address', address('0x4bbeeb066ed09b7aed07bf39eee0460dfa261520'), RowVariant.Warning);
 */
export const row = createBuilder(NodeType.Row, RowStruct, [
  'label',
  'value',
  'variant',
]);
