import { NpmSnapFileNames } from '@metamask/snaps-utils';
import {
  DEFAULT_SNAP_BUNDLE,
  DEFAULT_SNAP_ICON,
  getSnapManifest,
} from '@metamask/snaps-utils/test-utils';
import { assert } from '@metamask/utils';
import fetchMock from 'jest-fetch-mock';

import { HttpLocation } from './http';

fetchMock.enableMocks();

describe('HttpLocation', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('loads the files', async () => {
    const base = 'http://foo.bar/foo/';
    const manifest = getSnapManifest();
    const manifestStr = JSON.stringify(manifest);

    fetchMock.mockResponses(manifestStr, DEFAULT_SNAP_BUNDLE);
    const location = new HttpLocation(new URL(base));

    expect(await location.manifest()).toStrictEqual(
      expect.objectContaining({ value: manifestStr, result: manifest }),
    );

    const bundle = await location.fetch(manifest.source.location.npm.filePath);
    expect(bundle.toString()).toStrictEqual(DEFAULT_SNAP_BUNDLE);
  });

  it('throws if fetch fails', async () => {
    const base = 'http://foo.bar';

    fetchMock.mockResponse(async () => ({ status: 404, body: 'Not found' }));
    const location = new HttpLocation(new URL(base));
    await expect(location.manifest()).rejects.toThrow(
      'Failed to fetch "http://foo.bar/snap.manifest.json". Status code: 404.',
    );
    await expect(location.fetch('foo.js')).rejects.toThrow(
      'Failed to fetch "http://foo.bar/foo.js". Status code: 404.',
    );
  });

  it('returns proper root', () => {
    const base = 'http://foo.bar/foo/';
    expect(new HttpLocation(new URL(base)).root.toString()).toStrictEqual(base);
  });

  it.each([
    [
      'http://foo.bar/foo',
      {
        manifest: 'http://foo.bar/snap.manifest.json',
        bundle: 'http://foo.bar/foo.js',
      },
    ],
    [
      'http://foo.bar/foo/',
      {
        manifest: 'http://foo.bar/foo/snap.manifest.json',
        bundle: 'http://foo.bar/foo/foo.js',
      },
    ],
  ])('sets paths properly', async (base, canonical) => {
    fetchMock.mockResponses(
      JSON.stringify(getSnapManifest()),
      DEFAULT_SNAP_BUNDLE,
    );

    const location = new HttpLocation(new URL(base));
    const manifest = await location.manifest();
    const bundle = await location.fetch('./foo.js');

    expect(manifest.path).toBe('snap.manifest.json');
    expect(bundle.path).toBe('foo.js');
    expect(manifest.data.canonicalPath).toBe(canonical.manifest);
    expect(bundle.data.canonicalPath).toBe(canonical.bundle);
  });

  it.each([
    ['http://foo.bar/foo', 'http://foo.bar/snap.manifest.json'],
    ['https://foo.bar/foo', 'https://foo.bar/snap.manifest.json'],
    ['http://foo.bar/foo/', 'http://foo.bar/foo/snap.manifest.json'],
  ])('fetches manifest from proper location', async (base, actuallyFetched) => {
    fetchMock.mockResponses(JSON.stringify(getSnapManifest()));

    await new HttpLocation(new URL(base)).manifest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenNthCalledWith(1, actuallyFetched, undefined);
  });

  it('normalizes file paths', async () => {
    const manifest = getSnapManifest({
      filePath: './dist/bundle.js',
      iconPath: './images/icon.svg',
    });

    fetchMock.mockResponses(
      JSON.stringify(manifest),
      DEFAULT_SNAP_BUNDLE,
      DEFAULT_SNAP_ICON,
    );

    const location = new HttpLocation(new URL('http://foo.bar'));

    const manifestFile = await location.manifest();
    const bundleFile = await location.fetch(
      manifestFile.result.source.location.npm.filePath,
    );
    assert(manifestFile.result.source.location.npm.iconPath !== undefined);
    const iconFile = await location.fetch(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      manifest.source.location.npm.iconPath,
    );

    expect(manifestFile.path).toBe(NpmSnapFileNames.Manifest);
    expect(bundleFile.path).toBe('dist/bundle.js');
    expect(iconFile.path).toBe('images/icon.svg');
  });

  it('sanitizes manifests', async () => {
    const rawManifest = getSnapManifest({
      filePath: './dist/bundle.js',
      iconPath: './images/icon.svg',
    });

    const manifest = {
      ...rawManifest,
      initialPermissions: {
        ...rawManifest.initialPermissions,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __proto__: { foo: 'bar' },
      },
    };

    fetchMock.mockResponses(JSON.stringify(manifest));

    const location = new HttpLocation(new URL('http://foo.bar'));

    const manifestFile = await location.manifest();

    expect(manifestFile.path).toBe(NpmSnapFileNames.Manifest);
    expect(manifestFile.result).toStrictEqual(rawManifest);
    // @ts-expect-error Accessing via prototype
    expect(manifestFile.result.initialPermissions.foo).toBeUndefined();

    expect(
      // @ts-expect-error Accessing via prototype
      // eslint-disable-next-line no-proto, @typescript-eslint/naming-convention
      manifestFile.result.initialPermissions.__proto__.foo,
    ).toBeUndefined();
  });
});
