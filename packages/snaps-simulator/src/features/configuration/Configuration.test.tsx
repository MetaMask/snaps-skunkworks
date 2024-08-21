import { Configuration } from './Configuration';
import { render } from '../../utils';

describe('Configuration', () => {
  it('renders', () => {
    expect(() => render(<Configuration />)).not.toThrow();
  });
});
