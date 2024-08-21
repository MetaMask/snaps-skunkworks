import { TransactionPrefills } from './TransactionPrefills';
import { render } from '../../../../utils';

describe('TransactionPrefills', () => {
  it('renders', () => {
    expect(() =>
      render(<TransactionPrefills onClick={jest.fn()} />),
    ).not.toThrow();
  });
});
