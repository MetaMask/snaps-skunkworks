import { Manifest } from './Manifest';
import { render } from '../../utils';

jest.mock('react-monaco-editor');

describe('Manifest', () => {
  it('renders', () => {
    expect(() => render(<Manifest />)).not.toThrow();
  });
});
