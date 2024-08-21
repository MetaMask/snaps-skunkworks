import assert from 'assert';

import { isSnapIcon } from './is-snap-icon';
import { VirtualFile } from '../../virtual-file';

describe('isSnapIcon', () => {
  it('does nothing on valid icon', async () => {
    const svgIcon = new VirtualFile({
      value: '<svg></svg>',
      path: '/icon.svg',
    });

    const report = jest.fn();

    assert(isSnapIcon.structureCheck);
    await isSnapIcon.structureCheck(
      { svgIcon, localizationFiles: [], auxiliaryFiles: [] },
      { report },
    );

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports on invalid icon', async () => {
    const svgIcon = new VirtualFile({ value: 'foobar', path: './icon.svg' });

    const report = jest.fn();

    assert(isSnapIcon.structureCheck);
    await isSnapIcon.structureCheck(
      { svgIcon, localizationFiles: [], auxiliaryFiles: [] },
      { report },
    );

    expect(report).toHaveBeenCalledWith('Snap icon must be a valid SVG.');
  });
});
