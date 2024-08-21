import assert from 'assert';

import { manifestLocalization } from './manifest-localization';
import {
  getMockLocalizationFile,
  getMockSnapFilesWithUpdatedChecksum,
  getSnapManifest,
} from '../../test-utils';

describe('manifestLocalization', () => {
  it('does nothing on valid localization', async () => {
    const localization = getMockLocalizationFile({ locale: 'en' });
    const files = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({ locales: ['locales/en.json'] }),
      localizationFiles: [localization],
    });

    const report = jest.fn();

    assert(manifestLocalization.semanticCheck);
    await manifestLocalization.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports on invalid localization', async () => {
    const localizationFile = getMockLocalizationFile({
      locale: 'en',
      messages: {},
    });

    const files = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        proposedName: '{{ name }}',
        locales: ['locales/en.json'],
      }),
      localizationFiles: [localizationFile],
    });

    const report = jest.fn();

    assert(manifestLocalization.semanticCheck);
    await manifestLocalization.semanticCheck(files, { report });

    expect(report).toHaveBeenCalledWith(
      'Failed to localize Snap manifest: Failed to translate "{{ name }}": No translation found for "name" in "en" file.',
    );
  });
});
