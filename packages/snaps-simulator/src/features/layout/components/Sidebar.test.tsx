import { Sidebar } from './Sidebar';
import { render } from '../../../utils';

describe('Sidebar', () => {
  it('renders', () => {
    expect(() => render(<Sidebar />)).not.toThrow();
  });
});
