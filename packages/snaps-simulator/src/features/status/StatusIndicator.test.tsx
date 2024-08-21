import { StatusIndicator } from './StatusIndicator';
import { render } from '../../utils';

describe('StatusIndicator', () => {
  it('renders', () => {
    expect(() => render(<StatusIndicator />)).not.toThrow();
  });
});
