import { Navigation } from './Navigation';
import { render } from '../../utils';

describe('Navigation', () => {
  it('renders', () => {
    expect(() => render(<Navigation />)).not.toThrow();
  });
});
