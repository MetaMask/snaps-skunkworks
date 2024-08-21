import { Link } from './Link';
import { render } from '../utils';

describe('Link', () => {
  it('renders', () => {
    expect(() => render(<Link to="foo" />)).not.toThrow();
  });
});
