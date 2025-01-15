import type { FieldElement, FormElement } from '@metamask/snaps-sdk/jsx';
import {
  BoxChildStruct,
  FieldChildUnionStruct,
  FormChildStruct,
  Input,
  type BoxElement,
  type JSXElement,
} from '@metamask/snaps-sdk/jsx';
import {
  deepClone,
  getJsxChildren,
  hasChildren,
  serialiseJsx,
} from '@metamask/snaps-utils';
import { is } from '@metamask/superstruct';
import { assert, hasProperty } from '@metamask/utils';
import type { NodeModel } from '@minoru/react-dnd-treeview';
import * as estree from 'prettier/plugins/estree';
import * as typescript from 'prettier/plugins/typescript';
import { format } from 'prettier/standalone';

/**
 * Get the text of a node model.
 *
 * @param nodeModel - The node model.
 * @returns The text of the node model, or `null` if the node model does not
 * have text.
 */
export function getNodeText(nodeModel: NodeModel<JSXElement>) {
  assert(nodeModel.data, 'Node model must have data.');

  if (hasProperty(nodeModel.data.props, 'value')) {
    return nodeModel.data.props.value as string;
  }

  if (hasProperty(nodeModel.data.props, 'children')) {
    return nodeModel.data.props.children as string;
  }

  return null;
}

/**
 * Verify that the node is a valid box children.
 *
 * @param child - The node to verify.
 * @returns True if the node is a valid box children, otherwise false.
 */
export function isValidBoxChild(child: JSXElement) {
  return is(child, BoxChildStruct);
}

/**
 * Verify that the node is a valid form children.
 *
 * @param child - The node to verify.
 * @returns True if the node is a valid form children, otherwise false.
 */
export function isValidFormChild(child: JSXElement) {
  // Add a children to the Field to pass validation.
  const childCopy = deepClone(child);
  if (childCopy.type === 'Field') {
    childCopy.props.children = Input({ name: 'input' });
  }
  return is(childCopy, FormChildStruct);
}

/**
 * Verify that the node is a valid field children.
 *
 * @param child - The node to verify.
 * @returns True if the node is a valid field children, otherwise false.
 */
export function isValidFieldChild(child: JSXElement) {
  return is(child, FieldChildUnionStruct);
}
/**
 * Set the children of an element.
 *
 * @param parent - The parent element.
 * @param child - The child element.
 * @param validator - The validator function.
 * @returns The children of the parent element.
 */
export function setElementChildren(
  parent: JSXElement,
  child: JSXElement,
  validator: (child: JSXElement) => boolean,
) {
  const actual = getJsxChildren(parent);

  if (!validator(child)) {
    return actual;
  }

  return actual.length === 0 ? child : [...actual, child];
}
/**
 * Convert an array of node models to a component. This is useful for converting
 * the tree view data to a component that can be rendered.
 *
 * @param nodeModels - The array of node models.
 * @returns The component.
 */
export function nodeModelsToComponent(
  nodeModels: NodeModel<JSXElement>[],
): BoxElement {
  // We want to clone the node models so that we don't mutate the original data.
  const clonedModels = deepClone(nodeModels);

  for (const nodeModel of clonedModels) {
    assert(nodeModel.data, 'Node model must have data.');
    const parent = clonedModels.find((model) => model.id === nodeModel.parent);
    if (parent) {
      switch (parent.data?.type) {
        case 'Box':
          parent.data.props.children = setElementChildren(
            parent.data,
            nodeModel.data,
            isValidBoxChild,
          ) as BoxElement['props']['children'];

          break;
        case 'Form':
          parent.data.props.children = setElementChildren(
            parent.data,
            nodeModel.data,
            isValidFormChild,
          ) as FormElement['props']['children'];
          break;

        case 'Field':
          parent.data.props.children = setElementChildren(
            parent.data,
            nodeModel.data,
            isValidFieldChild,
          ) as FieldElement['props']['children'];
          break;

        default:
          throw new Error('Parent must be a box, form or field.');
      }
    }
  }

  const root = clonedModels.find((model) => model.parent === 0);

  assert(root?.data?.type === 'Box', 'Root must be a box.');

  return root.data;
}

/**
 * Get all the component types used in a component.
 *
 * @param component - The component.
 * @returns The component types.
 */
function getComponentTypes(component: JSXElement): string[] {
  const componentTypes = new Set<string>();
  componentTypes.add(component.type);

  const children = getJsxChildren(component);

  for (const child of children) {
    if (typeof child !== 'string') {
      componentTypes.add(child.type);

      if (hasChildren(component)) {
        const childComponentTypes = getComponentTypes(child);
        for (const childComponentType of childComponentTypes) {
          componentTypes.add(childComponentType);
        }
      }
    }
  }

  return Array.from(componentTypes).sort((a, b) => a.localeCompare(b));
}

/**
 * Convert a root Box to code. The code is formatted using prettier.
 *
 * @param component - The root panel.
 * @returns The code.
 */
export async function boxToCode(component: BoxElement): Promise<string> {
  const types = getComponentTypes(component).join(', ');

  return await format(
    `
      import { ${types} } from '@metamask/snaps-sdk/jsx';

      const Component = () => (${serialiseJsx(component)});
`,
    {
      parser: 'typescript',
      plugins: [estree, typescript],
      printWidth: 80,
      tabWidth: 2,
      singleQuote: true,
      trailingComma: 'all',
    },
  );
}

/**
 * Verify that an element can be dropped into a parent element.
 *
 * @param parent - The parent element.
 * @param element - The element to drop.
 * @returns True if the element can be dropped, otherwise false.
 */
export function canDropElement(parent?: JSXElement, element?: JSXElement) {
  if (!parent || !element) {
    return false;
  }

  switch (parent.type) {
    case 'Box':
      return isValidBoxChild(element);
    case 'Form':
      return isValidFormChild(element);
    case 'Field':
      return isValidFieldChild(element);
    default:
      return false;
  }
}
