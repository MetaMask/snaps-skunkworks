import { Validation } from './Validation';
import { render } from '../../../utils';

describe('Validation', () => {
  it('renders', () => {
    expect(() => render(<Validation />)).not.toThrow();
  });
});
