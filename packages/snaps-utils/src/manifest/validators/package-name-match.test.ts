import assert from 'assert';

import { packageNameMatch } from './package-name-match';
import { deepClone } from '../../deep-clone';
import { getMockSnapFiles, getSnapManifest } from '../../test-utils';

describe('packageNameMatch', () => {
  it('does nothing if name matches', async () => {
    const files = getMockSnapFiles();

    const report = jest.fn();

    assert(packageNameMatch.semanticCheck);
    await packageNameMatch.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports if name mismatches', async () => {
    const manifest = getSnapManifest({ packageName: 'foobar' });
    const files = getMockSnapFiles({ manifest });

    const report = jest.fn();

    assert(packageNameMatch.semanticCheck);
    await packageNameMatch.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledWith(
      '"snap.manifest.json" npm package name ("foobar") does not match the "package.json" "name" field ("@metamask/example-snap").',
      expect.any(Function),
    );

    const { manifest: newManifest } = await report.mock.calls[0][1]({
      manifest: deepClone(manifest),
    });
    expect(manifest.source.location.npm.packageName).toBe('foobar');
    expect(newManifest.source.location.npm.packageName).toBe(
      '@metamask/example-snap',
    );
  });
});
