import { Box } from '@chakra-ui/react';
import { ButtonType, InputType } from '@metamask/snaps-sdk';
import type {
  ButtonElement,
  FieldElement,
  FormElement,
  InputElement,
} from '@metamask/snaps-sdk/jsx';
import type { FunctionComponent } from 'react';

import { BaseNode } from './BaseNode';
import { EditableNodeInput } from './EditableNodeInput';
import { EditableNodeSelect } from './EditableNodeSelect';
import type { EditableNodeProps } from '../../../types';

export type MultiEditableComponent =
  | ButtonElement
  | InputElement
  | FormElement
  | FieldElement;

enum FieldType {
  String = 'string',
  Dropdown = 'dropdown',
}

type MultiEditableNodes = Record<
  MultiEditableComponent['type'],
  Record<
    string,
    { type: FieldType.String } | { type: FieldType.Dropdown; values: string[] }
  >
>;

export const MULTI_EDITABLE_NODES: MultiEditableNodes = {
  Input: {
    name: {
      type: FieldType.String,
    },
    label: {
      type: FieldType.String,
    },
    placeholder: {
      type: FieldType.String,
    },
    value: {
      type: FieldType.String,
    },
    type: {
      type: FieldType.Dropdown,
      values: [InputType.Text, InputType.Number, InputType.Password],
    },
    error: {
      type: FieldType.String,
    },
  },
  Button: {
    name: {
      type: FieldType.String,
    },
    value: {
      type: FieldType.String,
    },
    variant: {
      type: FieldType.Dropdown,
      values: ['primary', 'destructive'],
    },
    type: {
      type: FieldType.Dropdown,
      values: [ButtonType.Button, ButtonType.Submit],
    },
    children: {
      type: FieldType.String,
    },
  },
  Form: {
    name: {
      type: FieldType.String,
    },
  },
  Field: {
    label: {
      type: FieldType.String,
    },
    error: {
      type: FieldType.String,
    },
  },
};

/**
 * An editable node with multiple fields, which renders an editable component in the builder.
 *
 * @param props - The props of the component.
 * @param props.node - The editable node to render.
 * @param props.depth - The depth of the node in the tree.
 * @param props.isDragging - Whether the node is being dragged.
 * @param props.onChange - A function to call when the node changes.
 * @param props.onClose - A function to call when the node is closed.
 * @returns An editable node component.
 */
export const MultiEditableNode: FunctionComponent<
  EditableNodeProps<MultiEditableComponent>
> = ({ node, depth, isDragging, onChange, onClose }) => {
  if (!node.data) {
    return null;
  }

  const nodeDataOptions = MULTI_EDITABLE_NODES[node.data.type];
  return (
    <Box marginLeft={`${depth * 16}px`}>
      <BaseNode node={node} isDragging={isDragging} onClose={onClose}>
        <Box display="flex" flexDirection="column" gap="6px" width="100%">
          {Object.keys(nodeDataOptions).map((key) => {
            const property = nodeDataOptions[key];

            const handleChange = (value: string) => {
              onChange?.(node, key, value);
            };

            if (property.type === FieldType.String) {
              return (
                <EditableNodeInput
                  placeholder={key}
                  key={`${key}-input`}
                  defaultValue={
                    node.data?.props[key as keyof typeof node.data.props]
                  }
                  onChange={handleChange}
                />
              );
            }

            if (property.type === FieldType.Dropdown) {
              return (
                <EditableNodeSelect
                  key={`${key}-select`}
                  defaultValue={
                    node.data?.props[key as keyof typeof node.data.props]
                  }
                  onChange={handleChange}
                  options={property.values}
                />
              );
            }

            return null;
          })}
        </Box>
      </BaseNode>
    </Box>
  );
};
