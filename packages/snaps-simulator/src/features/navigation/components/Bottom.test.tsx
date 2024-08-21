import { Bottom } from './Bottom';
import { render } from '../../../utils';

describe('Bottom', () => {
  it('renders', () => {
    expect(() => render(<Bottom />)).not.toThrow();
  });
});
