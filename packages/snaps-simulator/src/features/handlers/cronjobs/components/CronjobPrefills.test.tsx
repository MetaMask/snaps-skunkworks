import { CronjobPrefills } from './CronjobPrefills';
import { render } from '../../../../utils';

describe('CronjobPrefills', () => {
  it('renders', () => {
    expect(() => render(<CronjobPrefills onClick={jest.fn()} />)).not.toThrow();
  });
});
