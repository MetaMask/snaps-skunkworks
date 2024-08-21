import {
  Flex,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@chakra-ui/react';
import type { FunctionComponent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { ConsoleContent } from './ConsoleContent';
import { getConsoleEntries } from './slice';
import { Icon } from '../../components';
import { useSelector } from '../../hooks';

/**
 * Console component.
 *
 * @returns The console component.
 */
export const Console: FunctionComponent = () => {
  const ref = useRef<HTMLDivElement>(null);

  const [collapsed, setCollapsed] = useState(false);

  const entries = useSelector(getConsoleEntries);

  useEffect(() => {
    if (ref.current) {
      // TODO: Maybe not scroll if the user is scrolled up?
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [entries]);

  const handleToggleConsole = () => {
    setCollapsed((state) => !state);
  };

  return (
    <Flex
      borderTop="1px solid"
      borderColor="border.default"
      height={collapsed ? '47px' : '266px'}
      transition="height 0.5s"
      flexDirection="column"
      overflow="hidden"
    >
      <Tabs display="flex" flexDirection="column" flex="1" overflow="hidden">
        <TabList pr="2">
          <Tab>Console</Tab>
          <Flex
            alignItems="center"
            ml="auto"
            onClick={handleToggleConsole}
            _hover={{
              cursor: 'pointer',
            }}
          >
            <Icon
              icon="arrowDown"
              height="14px"
              transform={collapsed ? 'rotate(180deg)' : 'rotate(0deg)'}
            />
          </Flex>
        </TabList>
        <TabPanels
          display="flex"
          flexDirection="column"
          flex="1"
          overflow="hidden"
        >
          <TabPanel
            ref={ref}
            display="flex"
            flexDirection="column"
            flex="1"
            overflowY="auto"
          >
            <ConsoleContent />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Flex>
  );
};
