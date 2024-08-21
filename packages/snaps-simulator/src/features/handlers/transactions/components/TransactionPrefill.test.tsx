import { TransactionPrefill } from './TransactionPrefill';
import { render } from '../../../../utils';
import { TRANSACTION_PRESETS } from '../presets';

describe('TransactionPrefill', () => {
  it('renders', () => {
    expect(() =>
      render(
        <TransactionPrefill
          name="ERC-20"
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          {...TRANSACTION_PRESETS[0].transaction}
          onClick={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });
});
