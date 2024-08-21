import { Flex } from '@chakra-ui/react';
import type { FunctionComponent, ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

import { Header, Sidebar } from './components';
import { Console } from '../console';

type LayoutProps = {
  children?: ReactNode;
};

/**
 * Render the layout of the application.
 *
 * @returns A React component.
 */
export const Layout: FunctionComponent<LayoutProps> = () => (
  <Flex direction="column" height="100vh">
    <Header />
    <Flex direction="row" flex="1" overflow="hidden">
      <Sidebar />
      <Flex direction="column" width="full">
        <Flex flex="1" overflow="hidden">
          {/* Note: Due to the use of `react-router-dom`, we have to use the `Outlet`
        component here, rather than `children`. This renders the current active
        page. */}
          <Outlet />
        </Flex>
        <Console />
      </Flex>
    </Flex>
  </Flex>
);
