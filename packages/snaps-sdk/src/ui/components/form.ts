import type { Infer } from '@metamask/superstruct';
import {
  array,
  assign,
  literal,
  object,
  string,
  union,
} from '@metamask/superstruct';

import { ButtonStruct } from './button';
import { InputStruct } from './input';
import { createBuilder } from '../builder';
import { NodeStruct, NodeType } from '../nodes';

export const FormComponentStruct = union([InputStruct, ButtonStruct]);

/**
 * The subset of nodes allowed as children in the {@link Form} node.
 */
export type FormComponent = Infer<typeof FormComponentStruct>;

export const FormStruct = assign(
  NodeStruct,
  object({
    type: literal(NodeType.Form),
    children: array(FormComponentStruct),
    name: string(),
  }),
);

/**
 * A form node that takes children {@link FormComponent} nodes and renders a form.
 *
 * @property type - The type of the node. Must be the string `form`.
 * @property children - The children of the node. Only {@link FormComponent} nodes are allowed.
 * @property name - The form name used to identify it.
 */
export type Form = Infer<typeof FormStruct>;

/**
 * Create a {@link Form} node.
 *
 * @param args - The node arguments. This can be either an array of children and a string, or
 * an object with a `name` and `children` property.
 * @param args.name - The form name used to identify it.
 * @param args.children - The child nodes of the form. This can be any valid
 * {@link FormComponent}.
 * @returns The form node as object.
 * @deprecated Snaps component functions are deprecated, in favor of the new JSX
 * components. This function will be removed in a future release.
 * @example
 * const node = form({
 *  name: 'myForm',
 *  children: [
 *    input({ name: 'myInput' }),
 *    button({ value: 'Hello, world!' }),
 *  ],
 * });
 *
 * const node = form('myForm', [input('myInput'), button('Hello, world!')]);
 */
export const form = createBuilder(NodeType.Form, FormStruct, [
  'name',
  'children',
]);
