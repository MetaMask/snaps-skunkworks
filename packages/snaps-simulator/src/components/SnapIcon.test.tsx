import { SnapIcon } from './SnapIcon';
import { render } from '../utils';

describe('SnapIcon', () => {
  it('renders', () => {
    expect(() => render(<SnapIcon snapName="foo-snap" />)).not.toThrow();
  });
});
