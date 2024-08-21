import { Bold, Text } from '@metamask/snaps-sdk/jsx';
import { getJsxChildren } from '@metamask/snaps-utils';

import { renderTextChildren } from './render';
import { SnapComponent } from '../features/renderer';

describe('renderTextChildren', () => {
  it('returns a sting child', () => {
    const element = Text({ children: 'Hello, world!' });

    const result = renderTextChildren(getJsxChildren(element), 'test');

    expect(result).toStrictEqual(['Hello, world!']);
  });

  it('returns a JSX child', () => {
    const element = Text({ children: Bold({ children: 'Hello world' }) });

    const result = renderTextChildren(getJsxChildren(element), 'test');

    expect(result).toStrictEqual([
      <SnapComponent
        key={`test-text-child-0`}
        id={`test-text-child-0`}
        node={Bold({ children: 'Hello world' })}
      />,
    ]);
  });
});
