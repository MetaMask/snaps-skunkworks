import { Author } from './Author';
import { render } from '../utils';

describe('Author', () => {
  it('renders', () => {
    expect(() =>
      render(
        <Author snapName="foo-snap" snapId="local:http://localhost:8000" />,
      ),
    ).not.toThrow();
  });
});
