import { Box, Flex } from '@chakra-ui/react';
import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import type {
  NodeModel,
  NodeRender,
  TreeMethods,
  TreeProps,
} from '@minoru/react-dnd-treeview';
import { Tree } from '@minoru/react-dnd-treeview';
import type { FunctionComponent } from 'react';
import { useEffect, useRef } from 'react';

import { Node } from './Node';
import { Start } from './Start';
import { canDropElement } from '../utils';

export type NodeTreeProps = {
  items: NodeModel<JSXElement>[];
  setItems: (items: NodeModel<JSXElement>[]) => void;
};

/**
 * A node tree, which renders the UI components in the builder.
 *
 * @param props - The props of the component.
 * @param props.items - The items to render in the tree.
 * @param props.setItems - A function to set the items in the tree.
 * @returns A node tree component.
 */
export const NodeTree: FunctionComponent<NodeTreeProps> = ({
  items,
  setItems,
}) => {
  const ref = useRef<TreeMethods>(null);

  const handleChange = (
    node: NodeModel<JSXElement>,
    key: string,
    value: string,
  ) => {
    // TODO: This code is a mess.
    const newItems: any = items.map((item) => {
      if (item.id === node.id) {
        return {
          ...item,
          data: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion
            type: item.data!.type,
            ...item.data,
            props: {
              ...item.data?.props,
              [key]: value,
            },
          },
          text: value,
        };
      }

      return item;
    });

    setItems(newItems);
  };

  const handleDrop = (newItems: NodeModel<JSXElement>[]) => {
    setItems(newItems);
  };

  const handleClose = (node: NodeModel<JSXElement>) => {
    const newItems = items.filter(
      (item) => item.id !== node.id && item.parent !== node.id,
    );

    setItems(newItems);
  };

  const handleRender: NodeRender<JSXElement> = (
    node,
    { depth, isDragging },
  ) => {
    if (items.length <= 1) {
      return <Start />;
    }

    return (
      <Node
        node={node}
        depth={depth}
        onChange={handleChange}
        onClose={handleClose}
        isDragging={isDragging}
      />
    );
  };

  const handleRenderPlaceholder = () => {
    return <Box width="100%" height="20px" />;
  };

  const handleCanDrag = (node?: NodeModel<JSXElement>) => {
    if (node) {
      return Number(node.id) >= 2;
    }

    return false;
  };

  const handleCanDrop: TreeProps<JSXElement>['canDrop'] = (
    _tree,
    { dropTarget, dropTargetId, dragSource },
  ) => {
    if (dropTargetId && dragSource?.data) {
      return (
        canDropElement(dropTarget?.data, dragSource?.data) &&
        dropTarget?.droppable &&
        Number(dropTargetId) > 0
      );
    }

    return false;
  };

  useEffect(() => {
    if (ref.current) {
      ref.current.openAll();
    }
  }, [items, ref]);

  return (
    <Flex
      border="1px solid"
      borderColor="border.default"
      borderRadius="lg"
      flex="1"
      sx={{
        // eslint-disable-next-line @typescript-eslint/naming-convention
        '& > ul': {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          marginY: '4',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          '& > li': {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            marginTop: '0',
          },
        },
        ul: { listStyleType: 'none' },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        li: { marginTop: '2' },
      }}
    >
      <Tree
        ref={ref}
        tree={items}
        rootId={0}
        render={handleRender}
        insertDroppableFirst={false}
        canDrag={handleCanDrag}
        canDrop={handleCanDrop}
        onDrop={handleDrop}
        initialOpen={true}
        sort={false}
        extraAcceptTypes={['template']}
        placeholderRender={handleRenderPlaceholder}
      />
    </Flex>
  );
};
