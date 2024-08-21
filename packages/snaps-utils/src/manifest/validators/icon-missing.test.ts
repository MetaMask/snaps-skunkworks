import assert from 'assert';

import { iconMissing } from './icon-missing';
import { getMockSnapFiles } from '../../test-utils';

describe('iconMissing', () => {
  it('does nothing if icon exists', async () => {
    const report = jest.fn();

    assert(iconMissing.semanticCheck);
    await iconMissing.semanticCheck(getMockSnapFiles(), { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports if icon is missing', async () => {
    const report = jest.fn();

    const files = getMockSnapFiles();
    delete files.svgIcon;

    assert(iconMissing.semanticCheck);
    await iconMissing.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledWith(
      'Could not find icon "images/icon.svg".',
    );
  });
});
