import assert from 'assert';

import { iconDeclared } from './icon-declared';
import { getMockSnapFiles, getSnapManifest } from '../../test-utils';

describe('iconDeclared', () => {
  it('does nothing if icon is declared', async () => {
    const report = jest.fn();
    assert(iconDeclared.semanticCheck);
    await iconDeclared.semanticCheck(getMockSnapFiles(), { report });
    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports if icon is not declared', async () => {
    const report = jest.fn();
    assert(iconDeclared.semanticCheck);

    const manifest = getSnapManifest();
    delete manifest.source.location.npm.iconPath;

    await iconDeclared.semanticCheck(getMockSnapFiles({ manifest }), {
      report,
    });

    expect(report).toHaveBeenCalledWith(
      'No icon found in the Snap manifest. It is recommended to include an icon for the Snap. See https://docs.metamask.io/snaps/how-to/design-a-snap/#guidelines-at-a-glance for more information.',
    );
  });
});
