import {
  Box as ChakraBox,
  Flex,
  List,
  ListItem,
  Text as ChakraText,
} from '@chakra-ui/react';
import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import {
  Box,
  Heading,
  Text,
  Divider,
  Copyable,
  Image,
  Button,
  Form,
  Input,
  Field,
} from '@metamask/snaps-sdk/jsx';
import type { FunctionComponent } from 'react';

import { TemplateComponent } from './TemplateComponent';
import type { IconName } from '../../../components';

type TemplateComponent = {
  icon: IconName;
  text: string;
  data: JSXElement;
  droppable: boolean;
};

const SVG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="0.501465" y="0.685059" width="10.6676" height="10.6676" rx="5.33381" fill="#0376C9"/>
<path d="M8.16102 4.04165L6.1717 2.99148C5.9623 2.87963 5.70848 2.87963 5.49907 2.99148L3.50976 4.04165C3.36381 4.11933 3.27497 4.26847 3.27497 4.43935C3.27497 4.60713 3.36381 4.75938 3.50976 4.83705L5.49907 5.88722C5.60378 5.94315 5.72117 5.97111 5.83539 5.97111C5.94961 5.97111 6.067 5.94315 6.1717 5.88722L8.16102 4.83705C8.30696 4.75938 8.3958 4.61024 8.3958 4.43935C8.3958 4.26847 8.30696 4.11933 8.16102 4.04165Z" fill="white"/>
<path d="M5.23789 6.16522L3.42988 5.20523C3.28687 5.13647 3.07359 5.19 2.94011 5.27126C2.80345 5.35566 2.724 5.49632 2.724 5.6526V7.37488C2.724 7.67182 2.89244 7.95883 3.16258 8.09324L5.01542 9.0825C5.07898 9.11376 5.1489 9.12939 5.21882 9.12939C5.30145 9.12939 5.38408 9.10751 5.45718 9.06375C5.59384 8.98248 5.67329 8.74394 5.67329 8.58766V6.86538C5.67647 6.56531 5.50803 6.2965 5.23789 6.16522Z" fill="white"/>
<path d="M8.73066 5.27251C8.594 5.19126 8.37945 5.13337 8.23961 5.20523L6.43603 6.16617C6.16588 6.30053 5.99744 6.56613 5.99744 6.8661V8.5878C5.99744 8.74404 6.07689 8.98351 6.21355 9.06475C6.28665 9.1085 6.36928 9.13037 6.45192 9.13037C6.52184 9.13037 6.59176 9.11475 6.65532 9.0835L8.50819 8.09324C8.77833 7.95888 8.94677 7.67539 8.94677 7.37542V5.65372C8.94677 5.49748 8.86732 5.35687 8.73066 5.27251Z" fill="white"/>
</svg>
`;

const TEMPLATE_COMPONENTS: TemplateComponent[] = [
  {
    icon: 'box',
    text: 'Box',
    data: Box({ children: null }),
    droppable: true,
  },
  {
    icon: 'heading',
    text: 'Heading',
    data: Heading({ children: 'Heading' }),
    droppable: false,
  },
  {
    icon: 'text',
    text: 'Text',
    data: Text({ children: 'Text' }),
    droppable: false,
  },
  {
    icon: 'divider',
    text: 'Divider',
    data: Divider({}),
    droppable: false,
  },
  {
    icon: 'copyable',
    text: 'Copyable',
    data: Copyable({ value: 'Text to copy' }),
    droppable: false,
  },
  {
    icon: 'image',
    text: 'Image',
    data: Image({ src: SVG }),
    droppable: false,
  },
  {
    icon: 'button',
    text: 'Button',
    data: Button({ children: 'Button' }),
    droppable: false,
  },
  {
    icon: 'form',
    text: 'Form',
    data: Form({
      name: 'form',
      children: [],
    }),
    droppable: true,
  },
  {
    icon: 'field',
    text: 'Field',
    data: Field({
      // @ts-expect-error - children is required
      children: null,
    }),
    droppable: true,
  },

  {
    icon: 'input',
    text: 'Input',
    data: Input({ name: 'input' }),
    droppable: false,
  },
];

export type ComponentsListProps = {
  nextId: number;
  incrementId: () => void;
};

export const TemplateComponentList: FunctionComponent<ComponentsListProps> = ({
  nextId,
  incrementId,
}) => (
  <ChakraBox marginBottom="4">
    <ChakraText
      fontSize="xs"
      fontWeight="600"
      lineHeight="133%"
      marginBottom="1"
    >
      Components
    </ChakraText>
    <Flex as={List} gap="2">
      {TEMPLATE_COMPONENTS.map((component) => (
        <ListItem key={`component-${component.text}`}>
          <TemplateComponent
            incrementId={incrementId}
            icon={component.icon}
            node={{
              id: nextId,
              parent: 0,
              droppable: component.droppable,
              text: component.text,
              data: component.data,
            }}
          />
        </ListItem>
      ))}
    </Flex>
  </ChakraBox>
);
