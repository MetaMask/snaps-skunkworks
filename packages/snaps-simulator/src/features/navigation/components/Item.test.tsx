import { List } from '@chakra-ui/react';

import { Item } from './Item';
import { render } from '../../../utils';

describe('Item', () => {
  it('renders', () => {
    expect(() =>
      render(
        <List>
          <Item path="foo">Bar</Item>
        </List>,
      ),
    ).not.toThrow();
  });
});
