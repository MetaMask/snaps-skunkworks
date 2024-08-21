import { Handler } from './Handler';
import { render } from '../../../utils';

describe('Handler', () => {
  it('renders', () => {
    expect(() => render(<Handler />, '/handler/onRpcRequest')).not.toThrow();
  });
});
