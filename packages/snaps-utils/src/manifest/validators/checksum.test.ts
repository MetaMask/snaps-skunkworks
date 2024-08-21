import assert from 'assert';

import { checksum } from './checksum';
import {
  DEFAULT_SNAP_SHASUM,
  getMockSnapFiles,
  getSnapManifest,
} from '../../test-utils';
import type { ValidatorFix } from '../validator-types';

describe('checksum', () => {
  it('does nothing on valid checksum', async () => {
    const report = jest.fn();
    assert(checksum.semanticCheck);
    await checksum.semanticCheck?.(getMockSnapFiles(), { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports on invalid checksum', async () => {
    const report = jest.fn();
    assert(checksum.semanticCheck);
    await checksum.semanticCheck?.(
      getMockSnapFiles({ manifest: getSnapManifest({ shasum: 'foobar' }) }),
      { report },
    );

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(
      expect.stringContaining(
        '"snap.manifest.json" "shasum" field does not match computed shasum.',
      ),
      expect.any(Function),
    );
  });

  it('fixes checksum', async () => {
    const manifest = getSnapManifest({ shasum: 'foobar' });

    let fix: ValidatorFix | undefined;
    const report = (_: any, fixer?: ValidatorFix) => {
      assert(fixer !== undefined);
      fix = fixer;
    };

    assert(checksum.semanticCheck);
    await checksum.semanticCheck?.(getMockSnapFiles({ manifest }), { report });
    assert(fix !== undefined);
    const { manifest: newManifest } = await fix({ manifest });

    expect(newManifest.source.shasum).toStrictEqual(DEFAULT_SNAP_SHASUM);
  });
});
