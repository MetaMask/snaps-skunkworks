import type { Infer } from '@metamask/superstruct';
import {
  boolean,
  nullable,
  record,
  string,
  union,
} from '@metamask/superstruct';
import { JsonStruct } from '@metamask/utils';

import { FileStruct } from './handlers';
import type { JSXElement } from '../jsx';
import { RootJSXElementStruct } from '../jsx';
import type { Component } from '../ui';
import { ComponentStruct } from '../ui';

/**
 * To avoid typing problems with the interface state when manipulating it we
 * have to differentiate the state of a form (that will be contained inside the
 * root state) and the root state since a key in the root stat can contain
 * either the value of an input or a sub-state of a form.
 */

export const StateStruct = union([FileStruct, string(), boolean()]);

export const FormStateStruct = record(string(), nullable(StateStruct));

export const InterfaceStateStruct = record(
  string(),
  union([FormStateStruct, nullable(StateStruct)]),
);

export type State = Infer<typeof StateStruct>;
export type FormState = Infer<typeof FormStateStruct>;
export type InterfaceState = Infer<typeof InterfaceStateStruct>;

export type ComponentOrElement = Component | JSXElement;
export const ComponentOrElementStruct = union([
  ComponentStruct,
  RootJSXElementStruct,
]);

export const InterfaceContextStruct = record(string(), JsonStruct);
export type InterfaceContext = Infer<typeof InterfaceContextStruct>;
