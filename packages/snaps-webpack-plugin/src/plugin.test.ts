// Allow Jest snapshots because the test outputs are illegible.
/* eslint-disable jest/no-restricted-matchers */

import {
  checkManifest,
  evalBundle,
  PostProcessWarning,
} from '@metamask/snaps-utils/node';
import { DEFAULT_SNAP_BUNDLE } from '@metamask/snaps-utils/test-utils';
import type { IFs } from 'memfs';
import { createFsFromVolume, Volume } from 'memfs';
import type { IPromisesAPI } from 'memfs/lib/promises';
import * as os from 'os';
import * as pathUtils from 'path';
import type { Stats, Configuration } from 'webpack';
import webpack from 'webpack';

import { writeManifest } from './manifest';
import type { Options } from './plugin';
import SnapsWebpackPlugin from './plugin';

jest.mock('@metamask/snaps-utils/node', () => ({
  ...jest.requireActual('@metamask/snaps-utils/node'),
  evalBundle: jest.fn(),
  checkManifest: jest.fn(),
}));

jest.mock('./manifest', () => ({
  writeManifest: jest.fn(),
}));

type BundleOptions = {
  code?: string;
  options?: Options;
  fileSystem?: IFs;
  webpackOptions?: Configuration;
};

const bundle = async ({
  code = DEFAULT_SNAP_BUNDLE,
  options = { eval: false, manifestPath: undefined },
  fileSystem = createFsFromVolume(new Volume()),
  webpackOptions,
}: BundleOptions = {}): Promise<{
  code: string;
  fs: IPromisesAPI;
  stats: Stats;
}> => {
  const { promises: fs } = fileSystem;

  const bundler = webpack({
    mode: 'none',
    entry: {
      foo: '/foo.js',
    },
    output: {
      path: '/lib',
      filename: '[name].js',
    },
    plugins: [new SnapsWebpackPlugin(options)],
    ...webpackOptions,
  });

  bundler.inputFileSystem = fileSystem as unknown as webpack.InputFileSystem;
  bundler.outputFileSystem = fileSystem as unknown as webpack.OutputFileSystem;

  await fs.mkdir('/lib', { recursive: true });
  await fs.writeFile('/foo.js', code);

  const outputStats = await new Promise<Stats>((resolve, reject) =>
    bundler.run((error, stats) => {
      if (error || !stats) {
        return reject(error);
      }

      return resolve(stats);
    }),
  );

  return {
    code: (await fs.readFile('/lib/foo.js', 'utf-8')) as string,
    fs,
    stats: outputStats,
  };
};

describe('SnapsWebpackPlugin', () => {
  it('processes files using Webpack', async () => {
    const { code } = await bundle();

    expect(code).toMatchSnapshot();
  });

  it('applies a transform', async () => {
    const { code } = await bundle({
      code: `
        // foo bar
        /* baz qux */
        const foo = 'bar';
      `,
    });

    expect(code).toMatchSnapshot();
    expect(code).not.toContain(`// foo bar`);
    expect(code).not.toContain(`/* baz qux */`);
  });

  it('forwards the options', async () => {
    const { code } = await bundle({
      code: `
        // foo bar
        /* baz qux */
        const foo = 'bar';
      `,
      options: {
        stripComments: false,
        eval: false,
        manifestPath: undefined,
      },
    });

    expect(code).toMatchSnapshot();
    expect(code).toContain(`// foo bar`);
    expect(code).toContain(`/* baz qux */`);
  });

  it('runs on the entire bundle', async () => {
    const fileSystem = createFsFromVolume(new Volume());
    const { promises: fs } = fileSystem;

    await fs.writeFile(
      '/bar.js',
      `
        // Returns baz
        export const bar = 'baz';
     `,
    );

    const { code } = await bundle({
      code: `
        import { bar } from './bar';

        // Sets foo to bar
        const foo = bar;
      `,
      fileSystem,
    });

    expect(code).toMatchSnapshot();
    expect(code).not.toContain(`// Sets foo to bar`);
    expect(code).not.toContain(`// Returns baz`);
  });

  it('logs post processing warnings', async () => {
    const { stats } = await bundle({
      code: 'console.log(Math.random());',
    });

    expect(stats.toJson().warnings?.[0].message).toMatch(
      PostProcessWarning.UnsafeMathRandom,
    );
  });

  it('logs post processing errors', async () => {
    const { stats } = await bundle({
      code: '<!-- Hello, world! -->',
    });

    expect(stats.toJson().errors?.[0].message).toMatch(
      `Failed to post process code:`,
    );
  });

  it('generates a source map', async () => {
    const { fs } = await bundle({
      webpackOptions: {
        devtool: 'source-map',
      },
    });

    const map = await fs.readFile('/lib/foo.js.map', 'utf-8');
    expect(map).toMatchSnapshot();
  });

  it('evals the bundle if configured', async () => {
    const mock = evalBundle as jest.MockedFunction<typeof evalBundle>;
    mock.mockResolvedValue(null);

    await bundle({
      options: {
        eval: true,
        manifestPath: undefined,
      },
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      pathUtils.resolve(os.tmpdir(), 'snaps-bundle.js'),
    );
  });

  it('checks the manifest if configured', async () => {
    const mock = checkManifest as jest.MockedFunction<typeof checkManifest>;
    mock.mockResolvedValue({
      files: undefined,
      updated: false,
      reports: [],
    });

    await bundle({
      options: {
        eval: false,
        manifestPath: '/snap.manifest.json',
      },
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('/', {
      updateAndWriteManifest: true,
      sourceCode: expect.any(String),
      writeFileFn: expect.any(Function),
    });

    const writeFileFn = mock.mock.calls[0][1]?.writeFileFn;
    expect(writeFileFn).toBeDefined();
    await writeFileFn?.('/snap.manifest.json', 'foo');

    expect(writeManifest).toHaveBeenCalledTimes(1);
    expect(writeManifest).toHaveBeenCalledWith(
      '/snap.manifest.json',
      'foo',
      expect.any(Function),
    );
  });

  it('does not fix the manifest if configured', async () => {
    const mock = checkManifest as jest.MockedFunction<typeof checkManifest>;
    mock.mockResolvedValue({
      files: undefined,
      updated: false,
      reports: [],
    });

    await bundle({
      options: {
        eval: false,
        manifestPath: '/snap.manifest.json',
        writeManifest: false,
      },
    });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('/', {
      updateAndWriteManifest: false,
      sourceCode: expect.any(String),
      writeFileFn: expect.any(Function),
    });
  });

  it('logs manifest errors if writeManifest is disabled', async () => {
    const mock = checkManifest as jest.MockedFunction<typeof checkManifest>;
    mock.mockResolvedValue({
      files: undefined,
      updated: false,
      reports: [
        { message: 'foo', severity: 'error' },
        { message: 'bar', severity: 'error' },
      ],
    });

    const { stats } = await bundle({
      options: {
        eval: false,
        manifestPath: '/snap.manifest.json',
        writeManifest: false,
      },
    });

    // eslint-disable-next-line jest/prefer-strict-equal
    expect(stats.compilation.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining(['foo', 'bar']),
    );
  });

  it('logs manifest warnings', async () => {
    const mock = checkManifest as jest.MockedFunction<typeof checkManifest>;
    mock.mockResolvedValue({
      files: undefined,
      updated: false,
      reports: [
        { message: 'foo', severity: 'warning' },
        { message: 'bar', severity: 'warning' },
      ],
    });

    const { stats } = await bundle({
      options: {
        eval: false,
        manifestPath: '/snap.manifest.json',
        writeManifest: false,
      },
    });

    expect(stats.toJson().warnings?.[0].message).toMatch('foo');
    expect(stats.toJson().warnings?.[1].message).toMatch('bar');
  });

  it('logs fixed problems', async () => {
    const mock = checkManifest as jest.MockedFunction<typeof checkManifest>;
    mock.mockResolvedValue({
      files: undefined,
      updated: false,
      reports: [
        { message: 'foo', severity: 'error', wasFixed: true },
        { message: 'bar', severity: 'warning', wasFixed: true },
      ],
    });

    const { stats } = await bundle({
      options: {
        eval: false,
        manifestPath: '/snap.manifest.json',
        writeManifest: true,
      },
    });

    expect(stats.toJson().warnings?.[0].message).toMatch('foo');
    expect(stats.toJson().warnings?.[1].message).toMatch('bar');
  });

  it('forwards errors', async () => {
    const mock = evalBundle as jest.MockedFunction<typeof evalBundle>;
    mock.mockRejectedValue(new Error('foo'));

    await expect(
      bundle({
        options: {
          eval: true,
          manifestPath: undefined,
        },
      }),
    ).rejects.toThrow('foo');
  });
});
