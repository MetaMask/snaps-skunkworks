import { Response } from './Response';
import { render } from '../../../utils';

describe('Response', () => {
  it('renders', () => {
    expect(() => render(<Response />, '/handler/onRpcRequest')).not.toThrow();
  });
});
