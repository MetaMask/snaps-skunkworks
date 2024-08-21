import assert from 'assert';

import { isPackageJson } from './is-package-json';
import { getPackageJson } from '../../test-utils';
import { VirtualFile } from '../../virtual-file';

describe('isPackageJson', () => {
  it("does nothing if file doesn't exist", async () => {
    const report = jest.fn();

    assert(isPackageJson.structureCheck);
    await isPackageJson.structureCheck(
      {
        localizationFiles: [],
        auxiliaryFiles: [],
      },
      { report },
    );

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('does nothing on valid package.json', async () => {
    const packageJson = getPackageJson();
    const packageJsonFile = new VirtualFile({
      value: JSON.stringify(packageJson),
      result: packageJson,
      path: '/package.json',
    });

    const report = jest.fn();

    assert(isPackageJson.structureCheck);
    await isPackageJson.structureCheck(
      {
        packageJson: packageJsonFile,
        localizationFiles: [],
        auxiliaryFiles: [],
      },
      { report },
    );

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports on invalid package.json', async () => {
    const packageJson = getPackageJson({ version: 'foo' });
    const packageJsonFile = new VirtualFile({
      value: JSON.stringify(packageJson),
      result: packageJson,
      path: '/package.json',
    });

    const report = jest.fn();

    assert(isPackageJson.structureCheck);
    await isPackageJson.structureCheck(
      {
        packageJson: packageJsonFile,
        localizationFiles: [],
        auxiliaryFiles: [],
      },
      { report },
    );

    expect(report).toHaveBeenCalledWith(
      '"package.json" is invalid: At path: version — Expected SemVer version, got "foo".',
    );
  });
});
