import { Icon } from './Icon';
import { render } from '../utils';

describe('Icon', () => {
  it('renders', () => {
    expect(() => render(<Icon icon="arrowRight" />)).not.toThrow();
  });
});
