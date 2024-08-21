import { Box, Container, List, Stack, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { Item, ManifestStatusIndicator } from './components';
import { NavigationTag } from './components/NavigationTag';
import { NAVIGATION_ITEMS } from './items';
import { Icon } from '../../components';
import { useSelector } from '../../hooks';

/**
 * The navigation component, which holds the navigation buttons.
 *
 * @returns The navigation component.
 */
export const Navigation: FunctionComponent = () => {
  const applicationState = useSelector((state) => state);

  return (
    <Container
      as="nav"
      size="fullWidth"
      display="flex"
      flexDirection="column"
      padding="2"
      flex="1"
    >
      <Stack as={List} spacing="2" flex="1">
        {NAVIGATION_ITEMS.map(
          ({ condition, icon, label, tag, description, path }) => {
            if (condition && !condition(applicationState)) {
              return null;
            }

            return (
              <Item key={path} path={path} tag={tag}>
                <Icon icon={icon} />
                <Box>
                  <Text>
                    <Box as="span" fontWeight="600">
                      {label}
                    </Box>{' '}
                    <NavigationTag path={path}>{tag}</NavigationTag>
                  </Text>
                  <Text fontSize="sm" marginTop="1">
                    {description}
                  </Text>
                </Box>
              </Item>
            );
          },
        )}

        {/* For now we declare this separately, because it has special state. */}
        <Item key="manifest" tag="manifest" path="/manifest">
          <Box position="relative">
            <Icon icon="manifest" />
            <ManifestStatusIndicator />
          </Box>
          <Box>
            <Text>
              <Box as="span" fontWeight="600">
                Manifest
              </Box>{' '}
              <NavigationTag path="/manifest">snap.manifest.json</NavigationTag>
            </Text>
            <Text fontSize="sm" marginTop="1">
              Validate the snap manifest
            </Text>
          </Box>
        </Item>
      </Stack>
    </Container>
  );
};
