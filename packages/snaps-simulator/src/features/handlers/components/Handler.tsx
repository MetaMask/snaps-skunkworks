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
import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { History } from './History';
import { PlayButton } from './PlayButton';
import { ResetTab } from './ResetTab';
import { ResetUserInterfaceTab } from './ResetUserInterfaceTab';
import { Response } from './Response';
import { UserInterface } from './UserInterface';
import { TestConditional } from '../../../components';
import { useSelector } from '../../../hooks';
import { IS_TEST_BUILD } from '../../../utils';
import { getUserInterface } from '../../simulation';

export const Handler: FunctionComponent = () => {
  const [tab, setTab] = useState(0);
  const userInterface = useSelector(getUserInterface);

  return (
    <Flex width="100%" direction="column" overflow="hidden">
      <Flex direction="row" flex="1" overflow="hidden">
        <TestConditional isTest={false}>
          <Flex direction="column" flex="1" width="50%" overflow="hidden">
            <Tabs
              display="flex"
              flexDirection="column"
              flex="1"
              overflow="hidden"
              isLazy={true}
              onChange={setTab}
            >
              <ResetTab />
              <TabList alignItems="center">
                <Tab>Request</Tab>
                <Tab>History</Tab>
                {tab === 0 && (
                  <Box marginLeft="auto">
                    <PlayButton />
                  </Box>
                )}
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
                  overflowY="auto"
                  data-testid="tab-request"
                >
                  <Outlet />
                </TabPanel>
                <TabPanel
                  padding="0"
                  display="flex"
                  flexDirection="column"
                  flex="1"
                  overflowY="auto"
                >
                  <History />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Flex>
        </TestConditional>
        <Box
          display="flex"
          flexDirection="column"
          flex="1"
          width="50%"
          borderLeft={IS_TEST_BUILD ? 'none' : '1px solid'}
          borderColor="border.default"
        >
          <Tabs
            display="flex"
            flexDirection="column"
            flex="1"
            overflow="hidden"
          >
            <ResetTab />
            <ResetUserInterfaceTab />

            <TabList>
              <Tab>Response</Tab>
              {userInterface && <Tab>UI</Tab>}
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
                data-testid="tab-response"
              >
                <Response />
              </TabPanel>
              {userInterface && (
                <TabPanel overflowY="auto" data-testid="tab-ui">
                  <UserInterface />
                </TabPanel>
              )}
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Flex>
  );
};
