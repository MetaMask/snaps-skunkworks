import {
  Box,
  Flex,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { Validation } from './components';
import { Editor } from '../../components';
import { useSelector } from '../../hooks';
import { getLocalizedSnapManifest } from '../simulation';

/**
 * Manifest page, which displays the manifest of a snap, and any errors that
 * may be present.
 *
 * @returns The Manifest component.
 */
export const Manifest: FunctionComponent = () => {
  const manifest = useSelector(getLocalizedSnapManifest);

  return (
    <Flex width="100%" direction="column" overflow="hidden">
      <Flex direction="row" flex="1" overflow="hidden">
        <Flex direction="column" flex="1" width="50%" overflow="hidden">
          <Tabs
            display="flex"
            flexDirection="column"
            flex="1"
            overflow="hidden"
          >
            <TabList>
              <Tab>Validation</Tab>
            </TabList>
            <TabPanels
              display="flex"
              flexDirection="column"
              flex="1"
              overflow="hidden"
            >
              <TabPanel
                display="flex"
                flexDirection="column"
                flex="1"
                padding="0"
              >
                <Validation />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Flex>
        <Box
          display="flex"
          flexDirection="column"
          flex="1"
          width="50%"
          borderLeft="1px solid"
          borderColor="border.default"
        >
          <Tabs
            display="flex"
            flexDirection="column"
            flex="1"
            overflow="hidden"
          >
            <TabList>
              <Tab>Manifest</Tab>
            </TabList>
            <TabPanels
              display="flex"
              flexDirection="column"
              flex="1"
              overflow="hidden"
            >
              <TabPanel
                display="flex"
                flexDirection="column"
                flex="1"
                padding="0"
              >
                <Editor
                  border="none"
                  value={JSON.stringify(manifest, null, 2)}
                  options={{ readOnly: true, wordWrap: 'on' }}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Flex>
  );
};
