import { Box, Text } from '@chakra-ui/react';
import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import type { NodeModel } from '@minoru/react-dnd-treeview';
import type { FunctionComponent } from 'react';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { ErrorBoundary } from './ErrorBoundary';
import {
  Delineator,
  DelineatorType,
  Window,
  Copyable,
} from '../../../components';
import { getSnapId } from '../../configuration';
import { Renderer } from '../../renderer';
import { getSnapName } from '../../simulation';
import { nodeModelsToComponent } from '../utils';

export type NodeRendererProps = {
  items: NodeModel<JSXElement>[];
};

/**
 * A node renderer, which renders the result of a node tree. The tree is
 * converted to a component, which is then rendered in the MetaMask window.
 *
 * @param props - The props of the component.
 * @param props.items - The items to render in the tree.
 * @returns A node renderer component.
 */
export const NodeRenderer: FunctionComponent<NodeRendererProps> = ({
  items,
}) => {
  const snapId = useSelector(getSnapId);
  const snapName = useSelector(getSnapName) ?? 'Unknown';
  const node = useMemo(() => nodeModelsToComponent(items), [items]);

  return (
    <Window snapName={snapName} snapId={snapId}>
      <Box margin="4" marginTop="0" flex="1">
        <ErrorBoundary
          fallback={
            <Delineator type={DelineatorType.Error} snapName={snapName}>
              <Text fontFamily="custom" fontSize="xs" marginBottom={4}>
                Contact the creators of <b>{snapName}</b> for further support.
              </Text>
              <Copyable value="The UI specified by the snap is invalid." />
            </Delineator>
          }
        >
          <Delineator type={DelineatorType.Content} snapName={snapName}>
            <Renderer content={node} />
          </Delineator>
        </ErrorBoundary>
      </Box>
    </Window>
  );
};
