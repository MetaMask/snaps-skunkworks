import { Box, List, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { Item } from './Item';
import { Icon } from '../../../components';
import { useDispatch } from '../../../hooks';
import { openConfigurationModal } from '../../configuration';

export const Bottom: FunctionComponent = () => {
  const dispatch = useDispatch();

  const handleOpenConfiguration = () => {
    dispatch(openConfigurationModal());
  };

  return (
    <List borderTop="1px solid" borderTopColor="border.default" padding="2">
      <Item
        path="https://github.com/MetaMask/snaps/tree/main/packages/snaps-simulator"
        isExternal={true}
        tag="github"
      >
        <Icon icon="gitHub" width="24px" />
        <Box>
          <Text>
            <Box as="span" fontWeight="600">
              GitHub
            </Box>
          </Text>
          <Text fontSize="sm" marginTop="1">
            Report an issue or contribute to the project
          </Text>
        </Box>
      </Item>
      <Item path="#" onClick={handleOpenConfiguration} tag="configuration">
        <Icon icon="configuration" width="24px" />
        <Box>
          <Text>
            <Box as="span" fontWeight="600">
              Settings
            </Box>
          </Text>
          <Text fontSize="sm" marginTop="1">
            Configure the simulation environment
          </Text>
        </Box>
      </Item>
    </List>
  );
};
