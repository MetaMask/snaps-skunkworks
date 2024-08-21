import { History } from './History';
import { render } from '../../../utils';

describe('History', () => {
  it('renders', () => {
    expect(() => render(<History />, '/handler/onRpcRequest')).not.toThrow();
  });
});
