import { Box } from '@metamask/snaps-sdk/jsx';

import { PromptDialog } from './PromptDialog';
import { render } from '../../utils';

describe('PromptDialog', () => {
  it('renders', () => {
    expect(() =>
      render(
        <PromptDialog
          snapName="foo-snap"
          snapId="local:http://localhost:8000"
          content={Box({ children: null })}
        />,
      ),
    ).not.toThrow();
  });
});
