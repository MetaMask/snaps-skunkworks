import { List, Tabs } from '@chakra-ui/react';

import { HistoryItem } from './HistoryItem';
import { render } from '../../../utils';

describe('HistoryItem', () => {
  it('renders', () => {
    expect(() =>
      render(
        <Tabs>
          <List>
            <HistoryItem item={{ request: {}, date: new Date() }} />
          </List>
        </Tabs>,
        '/handler/onRpcRequest',
      ),
    ).not.toThrow();
  });
});
