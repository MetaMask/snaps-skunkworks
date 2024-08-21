import { Prefill } from './Prefill';
import { render } from '../utils';

describe('Prefill', () => {
  it('renders', () => {
    expect(() => render(<Prefill>Prefill</Prefill>)).not.toThrow();
  });
});
