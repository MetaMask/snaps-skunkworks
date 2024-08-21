import { Request } from './Request';
import { render } from '../../../../utils';

jest.mock('react-monaco-editor');

describe('Request', () => {
  it('renders', () => {
    expect(() => render(<Request />)).not.toThrow();
  });
});
