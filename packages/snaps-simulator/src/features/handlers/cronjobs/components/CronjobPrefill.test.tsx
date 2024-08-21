import { CronjobPrefill } from './CronjobPrefill';
import { render } from '../../../../utils';

describe('CronjobPrefill', () => {
  it('renders', () => {
    expect(() =>
      render(<CronjobPrefill method="foo" params="bar" onClick={jest.fn()} />),
    ).not.toThrow();
  });
});
