import assert from 'assert';

import { versionMatch } from './version-match';
import { deepClone } from '../../deep-clone';
import { getMockSnapFiles, getSnapManifest } from '../../test-utils';

describe('versionMatch', () => {
  it('does nothing if versions match', async () => {
    const files = getMockSnapFiles();

    const report = jest.fn();

    assert(versionMatch.semanticCheck);
    await versionMatch.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports if versions mismatch', async () => {
    const manifest = getSnapManifest({ version: 'foo' });
    const files = getMockSnapFiles({
      manifest,
    });

    const report = jest.fn();

    assert(versionMatch.semanticCheck);
    await versionMatch.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledWith(
      '"snap.manifest.json" npm package version ("foo") does not match the "package.json" "version" field ("1.0.0").',
      expect.any(Function),
    );

    const { manifest: newManifest } = await report.mock.calls[0][1]({
      manifest: deepClone(manifest),
    });
    expect(manifest.version).toBe('foo');
    expect(newManifest.version).toBe('1.0.0');
  });
});
