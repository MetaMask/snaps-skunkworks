import { Box } from '@metamask/snaps-sdk/jsx';

import { AlertDialog } from './AlertDialog';
import { render } from '../../utils';

describe('AlertDialog', () => {
  it('renders', () => {
    expect(() =>
      render(
        <AlertDialog
          snapName="foo-snap"
          snapId="local:http://localhost:8000"
          content={Box({ children: null })}
        />,
      ),
    ).not.toThrow();
  });
});
