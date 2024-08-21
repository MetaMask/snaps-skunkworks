import { Tabs } from '@chakra-ui/react';

import { UserInterface } from './UserInterface';
import { render } from '../../../utils';

describe('UserInterface', () => {
  it('renders', () => {
    expect(() =>
      render(
        <Tabs>
          <UserInterface />
        </Tabs>,
        '/handler/onRpcRequest',
      ),
    ).not.toThrow();
  });
});
