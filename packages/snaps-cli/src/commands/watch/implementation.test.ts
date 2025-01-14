import {
  DEFAULT_SNAP_BUNDLE,
  getPackageJson,
  getSnapManifest,
} from '@metamask/snaps-utils/test-utils';
import normalFs from 'fs';
import type webpackModule from 'webpack';

import { getMockConfig } from '../../test-utils';
import { getCompiler } from '../../webpack';
import type * as webpack from '../../webpack';
import { watch } from './implementation';

const { promises: fs } = normalFs;

jest.mock('fs');

jest.mock('../../webpack', () => ({
  ...jest.requireActual('../../webpack'),
  getCompiler: jest.fn<
    ReturnType<typeof getCompiler>,
    Parameters<typeof getCompiler>
  >(async (...args) => {
    const compiler = await jest
      .requireActual<typeof webpack>('../../webpack')
      .getCompiler(...args);

    compiler.inputFileSystem =
      normalFs as unknown as webpackModule.InputFileSystem;
    compiler.outputFileSystem =
      normalFs as unknown as webpackModule.OutputFileSystem;

    return compiler;
  }),
}));

describe('watch', () => {
  beforeEach(async () => {
    await fs.mkdir('/snap');
    await fs.writeFile('/snap/input.js', DEFAULT_SNAP_BUNDLE);
    await fs.writeFile(
      '/snap/snap.manifest.json',
      JSON.stringify(getSnapManifest()),
    );
    await fs.writeFile('/snap/package.json', JSON.stringify(getPackageJson()));
    await fs.mkdir('/snap/images');
    await fs.writeFile('/snap/images/icon.svg', '<svg></svg>');
  });

  afterEach(async () => {
    await fs.rm('/snap', { force: true, recursive: true });
  });

  it('runs the Webpack compiler in watch mode', async () => {
    const mock = getCompiler as jest.MockedFunction<typeof getCompiler>;
    const watchMock = jest
      .fn()
      .mockImplementation((_options, callback) => callback());

    // @ts-expect-error - Partial mock.
    mock.mockImplementationOnce(() => ({
      watch: watchMock,
      watching: {},
    }));

    await watch(
      getMockConfig('webpack', {
        input: '/snap/input.js',
      }),
    );

    expect(watchMock).toHaveBeenCalled();
  });

  it('rejects if the watch function returns an error', async () => {
    const mock = getCompiler as jest.MockedFunction<typeof getCompiler>;
    const error = new Error('Webpack error.');
    const watchMock = jest
      .fn()
      .mockImplementation((_options, callback) => callback(error));

    // @ts-expect-error - Partial mock.
    mock.mockImplementationOnce(() => ({
      watch: watchMock,
    }));

    await expect(
      watch(
        getMockConfig('webpack', {
          input: '/snap/input.js',
        }),
      ),
    ).rejects.toThrow(error);
  });
});
