import { Header } from './Header';
import { render } from '../../../utils';

describe('Header', () => {
  it('renders', () => {
    expect(() => render(<Header />)).not.toThrow();
  });
});
