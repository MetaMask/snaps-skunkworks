import { Box } from '@metamask/snaps-sdk/jsx';

import { ConfirmationDialog } from './ConfirmationDialog';
import { render } from '../../utils';

describe('ConfirmationDialog', () => {
  it('renders', () => {
    expect(() =>
      render(
        <ConfirmationDialog
          snapName="foo-snap"
          snapId="local:http://localhost:8000"
          content={Box({ children: null })}
        />,
      ),
    ).not.toThrow();
  });
});
