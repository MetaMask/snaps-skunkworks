import assert from 'assert';

import { packageJsonRecommendedFields } from './package-json-recommended-fields';
import { getMockSnapFiles, getPackageJson } from '../../test-utils';

describe('packageJsonRecommendedFields', () => {
  it('does nothing if fields exist', async () => {
    const files = getMockSnapFiles();

    const report = jest.fn();

    assert(packageJsonRecommendedFields.semanticCheck);
    await packageJsonRecommendedFields.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports if "repository" is missing', async () => {
    const packageJson = getPackageJson();
    delete packageJson.repository;
    const files = getMockSnapFiles({ packageJson });

    const report = jest.fn();

    assert(packageJsonRecommendedFields.semanticCheck);
    await packageJsonRecommendedFields.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledWith(
      'Missing recommended package.json property: "repository".',
    );
  });
});
