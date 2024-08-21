import { Logo } from './Logo';
import { render } from '../utils';

describe('Logo', () => {
  it('renders', () => {
    expect(() => render(<Logo />)).not.toThrow();
  });
});
