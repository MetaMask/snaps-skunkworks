import assert from 'assert';

import { expectedFiles } from './expected-files';
import { getMockSnapFiles } from '../../test-utils';
import type { UnvalidatedSnapFiles } from '../../types';

describe('expectedFiles', () => {
  it('does nothing if files exist', async () => {
    const report = jest.fn();
    assert(expectedFiles.structureCheck);
    await expectedFiles.structureCheck(getMockSnapFiles(), { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it.each(['manifest', 'packageJson', 'sourceCode'] as const)(
    'reports if %s is missing',
    async (missingFile) => {
      const files: UnvalidatedSnapFiles = getMockSnapFiles();
      delete files[missingFile];

      const report = jest.fn();
      assert(expectedFiles.structureCheck);
      await expectedFiles.structureCheck(files, { report });

      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        expect.stringContaining('Missing file'),
      );
    },
  );
});
