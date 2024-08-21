import assert from 'assert';

import { isLocalizationFile } from './is-localization-file';
import { getMockLocalizationFile } from '../../test-utils';
import { VirtualFile } from '../../virtual-file';

describe('isLocalizationFile', () => {
  it('does nothing on valid files', async () => {
    const localizationFiles = [
      getMockLocalizationFile({ locale: 'en' }),
      getMockLocalizationFile({ locale: 'pl' }),
    ].map(
      (localization) =>
        new VirtualFile({
          value: JSON.stringify(localization),
          result: localization,
        }),
    );

    const report = jest.fn();

    assert(isLocalizationFile.structureCheck);
    await isLocalizationFile.structureCheck(
      { localizationFiles, auxiliaryFiles: [] },
      { report },
    );

    expect(report).toHaveBeenCalledTimes(0);
  });

  it('reports on invalid file', async () => {
    const localization = getMockLocalizationFile({
      locale: 'en',
      // @ts-expect-error - Invalid type.
      messages: 'foo',
    });
    const localizationFile = new VirtualFile({
      value: JSON.stringify(localization),
      result: localization,
      path: '/foo',
    });

    const report = jest.fn();

    assert(isLocalizationFile.structureCheck);
    await isLocalizationFile.structureCheck(
      {
        localizationFiles: [localizationFile],
        auxiliaryFiles: [],
      },
      { report },
    );

    expect(report).toHaveBeenCalledWith(
      'Failed to validate localization file "/foo": At path: messages — Expected a value of type record, but received: "foo".',
    );
  });
});
