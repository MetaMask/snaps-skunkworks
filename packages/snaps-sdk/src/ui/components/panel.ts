import type { Infer, Struct } from '@metamask/superstruct';
import { array, assign, lazy, literal, object } from '@metamask/superstruct';

import { AddressStruct } from './address';
import { ButtonStruct } from './button';
import { CopyableStruct } from './copyable';
import { DividerStruct } from './divider';
import { FormStruct } from './form';
import { HeadingStruct } from './heading';
import { ImageStruct } from './image';
import { InputStruct } from './input';
import { RowStruct } from './row';
import { SpinnerStruct } from './spinner';
import { TextStruct } from './text';
import { typedUnion } from '../../internals';
import { createBuilder } from '../builder';
import { NodeStruct, NodeType } from '../nodes';

/**
 * @internal
 */
export const ParentStruct = assign(
  NodeStruct,
  object({
    // This node references itself indirectly, so we need to use `lazy()`.
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    children: array(lazy(() => ComponentStruct)),
  }),
);

/**
 * A node which supports child nodes. This is used for nodes that render their
 * children, such as {@link Panel}.
 *
 * @property type - The type of the node.
 * @property children - The children of the node
 * @internal
 */
export type Parent = Infer<typeof ParentStruct>;

/**
 * @internal
 */
export const PanelStruct: Struct<Panel> = assign(
  ParentStruct,
  object({
    type: literal(NodeType.Panel),
  }),
);

/**
 * A panel node, which renders its children.
 *
 * @property type - The type of the node, must be the string 'text'.
 * @property value - The text content of the node, either as plain text, or as a
 * markdown string.
 */
// This node references itself indirectly, so it cannot be inferred.
export type Panel = {
  type: NodeType.Panel;
  children: Component[];
};

/**
 * Create a {@link Panel} node.
 *
 * @param args - The node arguments. This can be either an array of children, or
 * an object with a `children` property.
 * @param args.children - The child nodes of the panel. This can be any valid
 * {@link Component}.
 * @returns The panel node as object.
 * @deprecated Snaps component functions are deprecated, in favor of the new JSX
 * components. This function will be removed in a future release.
 * @example
 * const node = panel({
 *  children: [
 *    heading({ text: 'Hello, world!' }),
 *    text({ text: 'This is a panel.' }),
 *  ],
 * });
 *
 * const node = panel([
 *   heading('Hello, world!'),
 *   text('This is a panel.'),
 * ]);
 */
export const panel = createBuilder(NodeType.Panel, PanelStruct, ['children']);

// This is defined separately from `Component` to avoid circular dependencies.
export const ComponentStruct = typedUnion([
  CopyableStruct,
  DividerStruct,
  HeadingStruct,
  ImageStruct,
  PanelStruct,
  SpinnerStruct,
  TextStruct,
  RowStruct,
  AddressStruct,
  InputStruct,
  FormStruct,
  ButtonStruct,
]);

/**
 * All supported component types.
 */
export type Component = Infer<typeof ComponentStruct>;
