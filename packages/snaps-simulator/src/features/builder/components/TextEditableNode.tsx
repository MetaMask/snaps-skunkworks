import { Box, Input as ChakraInput } from '@chakra-ui/react';
import type {
  CopyableElement,
  HeadingElement,
  TextElement,
} from '@metamask/snaps-sdk/jsx';
import { assert, hasProperty } from '@metamask/utils';
import type { ChangeEvent, FunctionComponent } from 'react';
import { useState } from 'react';

import { BaseNode } from './BaseNode';
import type { EditableNodeProps } from '../../../types';
import { getNodeText } from '../utils';

export type TextEditableComponent =
  | TextElement
  | HeadingElement
  | CopyableElement;

export const TEXT_EDITABLE_NODES = ['Heading', 'Text', 'Image', 'Copyable'];

/**
 * An editable node with a text field, which renders an editable component in the builder.
 *
 * @param props - The props of the component.
 * @param props.node - The editable node to render.
 * @param props.depth - The depth of the node in the tree.
 * @param props.isDragging - Whether the node is being dragged.
 * @param props.onChange - A function to call when the node changes.
 * @param props.onClose - A function to call when the node is closed.
 * @returns An editable node component.
 */
export const TextEditableNode: FunctionComponent<
  EditableNodeProps<TextEditableComponent>
> = ({ node, depth, isDragging, onChange, onClose }) => {
  const text = getNodeText(node);
  assert(text !== null, 'Node must have text.');
  const [value, setValue] = useState(text);

  const handleChange = (newValue: ChangeEvent<HTMLInputElement>) => {
    setValue(newValue.target.value);
    onChange?.(
      node,
      hasProperty(node.data?.props as Record<string, unknown>, 'value')
        ? 'value'
        : 'children',
      newValue.target.value,
    );
  };

  return (
    <Box marginLeft={`${depth * 16}px`}>
      <BaseNode node={node} isDragging={isDragging} onClose={onClose}>
        <ChakraInput
          value={value}
          onChange={handleChange}
          fontSize="sm"
          bg="chakra-body-bg"
          borderColor="border.default"
          outline="none"
          _active={{
            borderColor: 'border.active',
            outline: 'none',
            boxShadow: 'none',
          }}
          _focusVisible={{
            borderColor: 'border.active',
            outline: 'none',
            boxShadow: 'none',
          }}
        />
      </BaseNode>
    </Box>
  );
};
