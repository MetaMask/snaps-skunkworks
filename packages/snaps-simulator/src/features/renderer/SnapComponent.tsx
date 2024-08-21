import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import type { FunctionComponent } from 'react';

import {
  Bold,
  Copyable,
  Box,
  Text,
  Divider,
  Heading,
  Spinner,
  Image,
  Button,
  Form,
  Input,
  Field,
  Italic,
  Link,
} from './components';
import { generateKey } from '../../utils';

export const components: Partial<
  Record<
    string,
    FunctionComponent<{ id: string; node: unknown; form?: string }>
  >
> = {
  Bold,
  Box,
  Button,
  Copyable,
  Divider,
  Field,
  Form,
  Heading,
  Input,
  Italic,
  Link,
  Spinner,
  Text,
  Image,
};

type SnapComponentProps = {
  node: JSXElement | null;
  form?: string;
  map?: Record<string, number>;
  id?: string;
};

export const SnapComponent: FunctionComponent<SnapComponentProps> = ({
  node,
  form,
  map = {},
  id,
}) => {
  if (!node) {
    return null;
  }

  const key = id ?? generateKey(map, node);

  const ReactComponent = components[node.type];
  if (!ReactComponent) {
    throw new Error(`Unknown component type: ${node.type}.`);
  }

  return <ReactComponent id={key} node={node} form={form} key={key} />;
};
