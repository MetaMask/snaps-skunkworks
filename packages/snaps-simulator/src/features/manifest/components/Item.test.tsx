import { List } from '@chakra-ui/react';

import { Item } from './Item';
import { render } from '../../../utils';

describe('Item', () => {
  it('renders', () => {
    expect(() =>
      render(
        <List>
          <Item isValid={true} name="foo" manifestName="bar" />
        </List>,
      ),
    ).not.toThrow();
  });
});
