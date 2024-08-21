import { Notifications } from './Notifications';
import { render } from '../../utils';

describe('Notifications', () => {
  it('renders', () => {
    expect(() => render(<Notifications />)).not.toThrow();
  });
});
