import type { SnapManifest } from '@metamask/snaps-utils';
import {
  createSnapManifest,
  DEFAULT_REQUESTED_SNAP_VERSION,
  getTargetVersion,
  isValidUrl,
  NpmSnapIdStruct,
  VirtualFile,
  normalizeRelative,
  parseJson,
} from '@metamask/snaps-utils';
import type { SemVerRange, SemVerVersion } from '@metamask/utils';
import {
  assert,
  assertIsSemVerVersion,
  assertStruct,
  isObject,
  isValidSemVerVersion,
} from '@metamask/utils';
import { createGunzip } from 'browserify-zlib';
import concat from 'concat-stream';
import getNpmTarballUrl from 'get-npm-tarball-url';
import { pipeline } from 'readable-stream';
import type { Readable, Writable } from 'readable-stream';
import { ReadableWebToNodeStream } from 'readable-web-to-node-stream';
import { extract as tarExtract } from 'tar-stream';

import type { DetectSnapLocationOptions, SnapLocation } from './location';

export const DEFAULT_NPM_REGISTRY = new URL('https://registry.npmjs.org');

interface NpmMeta {
  registry: URL;
  packageName: string;
  requestedRange: SemVerRange;
  version?: string;
  fetch: typeof fetch;
  resolveVersion: (range: SemVerRange) => Promise<SemVerRange>;
}
export interface NpmOptions {
  /**
   * @default DEFAULT_REQUESTED_SNAP_VERSION
   */
  versionRange?: SemVerRange;
  /**
   * Whether to allow custom NPM registries outside of {@link DEFAULT_NPM_REGISTRY}.
   *
   * @default false
   */
  allowCustomRegistries?: boolean;
}

// Base class for NPM implementation, useful for extending with custom NPM fetching logic
export abstract class BaseNpmLocation implements SnapLocation {
  protected readonly meta: NpmMeta;

  #validatedManifest?: VirtualFile<SnapManifest>;

  #files?: Map<string, VirtualFile>;

  constructor(url: URL, opts: DetectSnapLocationOptions = {}) {
    const allowCustomRegistries = opts.allowCustomRegistries ?? false;
    const fetchFunction = opts.fetch ?? globalThis.fetch.bind(globalThis);
    const requestedRange = opts.versionRange ?? DEFAULT_REQUESTED_SNAP_VERSION;
    const defaultResolve = async (range: SemVerRange) => range;
    const resolveVersion = opts.resolveVersion ?? defaultResolve;

    assertStruct(url.toString(), NpmSnapIdStruct, 'Invalid Snap Id: ');

    let registry: string | URL;
    if (
      url.host === '' &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    ) {
      registry = DEFAULT_NPM_REGISTRY;
    } else {
      registry = 'https://';
      if (url.username) {
        registry += url.username;
        if (url.password) {
          registry += `:${url.password}`;
        }
        registry += '@';
      }
      registry += url.host;
      registry = new URL(registry);
      assert(
        allowCustomRegistries,
        new TypeError(
          `Custom NPM registries are disabled, tried to use "${registry.toString()}".`,
        ),
      );
    }

    assert(
      registry.pathname === '/' &&
        registry.search === '' &&
        registry.hash === '',
    );

    assert(
      url.pathname !== '' && url.pathname !== '/',
      new TypeError('The package name in NPM location is empty.'),
    );
    let packageName = url.pathname;
    if (packageName.startsWith('/')) {
      packageName = packageName.slice(1);
    }

    this.meta = {
      requestedRange,
      registry,
      packageName,
      fetch: fetchFunction,
      resolveVersion,
    };
  }

  async manifest(): Promise<VirtualFile<SnapManifest>> {
    if (this.#validatedManifest) {
      return this.#validatedManifest.clone();
    }

    const vfile = await this.fetch('snap.manifest.json');
    const result = parseJson(vfile.toString());
    vfile.result = createSnapManifest(result);
    this.#validatedManifest = vfile as VirtualFile<SnapManifest>;

    return this.manifest();
  }

  async fetch(path: string): Promise<VirtualFile> {
    const relativePath = normalizeRelative(path);
    if (!this.#files) {
      await this.#lazyInit();
      assert(this.#files !== undefined);
    }
    const vfile = this.#files.get(relativePath);
    assert(
      vfile !== undefined,
      new TypeError(`File "${path}" not found in package.`),
    );
    return vfile.clone();
  }

  get packageName(): string {
    return this.meta.packageName;
  }

  get version(): string {
    assert(
      this.meta.version !== undefined,
      'Tried to access version without first fetching NPM package.',
    );
    return this.meta.version;
  }

  get registry(): URL {
    return this.meta.registry;
  }

  get versionRange(): SemVerRange {
    return this.meta.requestedRange;
  }

  async #lazyInit() {
    assert(this.#files === undefined);
    const resolvedVersion = await this.meta.resolveVersion(
      this.meta.requestedRange,
    );

    const { tarballURL, targetVersion } = await resolveNpmVersion(
      this.meta.packageName,
      resolvedVersion,
      this.meta.registry,
      this.meta.fetch,
    );

    if (!isValidUrl(tarballURL) || !tarballURL.toString().endsWith('.tgz')) {
      throw new Error(
        `Failed to find valid tarball URL in NPM metadata for package "${this.meta.packageName}".`,
      );
    }

    // Override the tarball hostname/protocol with registryUrl hostname/protocol
    const newTarballUrl = new URL(tarballURL);
    newTarballUrl.hostname = this.meta.registry.hostname;
    newTarballUrl.protocol = this.meta.registry.protocol;

    const files = await this.fetchNpmTarball(newTarballUrl);

    this.#files = files;
    this.meta.version = targetVersion;
  }

  /**
   * Fetches and unpacks the tarball (`.tgz` file) from the specified URL.
   *
   * @param tarballUrl - The tarball URL to fetch and unpack.
   * @returns A the files for the package tarball.
   * @throws If fetching the tarball fails.
   */
  abstract fetchNpmTarball(tarballUrl: URL): Promise<Map<string, VirtualFile>>;
}

// Safety limit for tarballs, 250 MB in bytes
export const TARBALL_SIZE_SAFETY_LIMIT = 262144000;

// Main NPM implementation, contains a browser tarball fetching implementation.
export class NpmLocation extends BaseNpmLocation {
  /**
   * Fetches and unpacks the tarball (`.tgz` file) from the specified URL.
   *
   * @param tarballUrl - The tarball URL to fetch and unpack.
   * @returns A the files for the package tarball.
   * @throws If fetching the tarball fails.
   */
  async fetchNpmTarball(
    tarballUrl: URL,
  ): Promise<Map<string, VirtualFile<unknown>>> {
    // Perform a raw fetch because we want the Response object itself.
    const tarballResponse = await this.meta.fetch(tarballUrl.toString());
    if (!tarballResponse.ok || !tarballResponse.body) {
      throw new Error(
        `Failed to fetch tarball for package "${this.meta.packageName}".`,
      );
    }

    // We assume that NPM is a good actor and provides us with a valid `content-length` header.
    const tarballSizeString = tarballResponse.headers.get('content-length');
    assert(tarballSizeString, 'Snap tarball has invalid content-length');
    const tarballSize = parseInt(tarballSizeString, 10);
    assert(
      tarballSize <= TARBALL_SIZE_SAFETY_LIMIT,
      'Snap tarball exceeds size limit',
    );
    return new Promise((resolve, reject) => {
      const files = new Map();

      const tarballStream = createTarballStream(
        getNpmCanonicalBasePath(this.meta.registry, this.meta.packageName),
        files,
      );

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const body = tarballResponse.body!;

      // The "gz" in "tgz" stands for "gzip". The tarball needs to be decompressed
      // before we can actually grab any files from it.
      // To prevent recursion-based zip bombs, we should not allow recursion here.

      // If native decompression stream is available we use that, otherwise fallback to zlib.
      if ('pipeThrough' in body && 'DecompressionStream' in globalThis) {
        const decompressionStream = new DecompressionStream('gzip');
        const decompressedStream = body.pipeThrough(decompressionStream);

        pipeline(
          getNodeStream(decompressedStream),
          tarballStream,
          (error: unknown) => {
            error ? reject(error) : resolve(files);
          },
        );
        return;
      }

      pipeline(
        getNodeStream(body),
        createGunzip(),
        tarballStream,
        (error: unknown) => {
          error ? reject(error) : resolve(files);
        },
      );
    });
  }
}

// Incomplete type
export type PartialNpmMetadata = {
  versions: Record<string, { dist: { tarball: string } }>;
};

/**
 * Fetches the NPM metadata of the specified package from
 * the public npm registry.
 *
 * @param packageName - The name of the package whose metadata to fetch.
 * @param registryUrl - The URL of the npm registry to fetch the metadata from.
 * @param fetchFunction - The fetch function to use. Defaults to the global
 * {@link fetch}. Useful for Node.js compatibility.
 * @returns The NPM metadata object.
 * @throws If fetching the metadata fails.
 */
export async function fetchNpmMetadata(
  packageName: string,
  registryUrl: URL,
  fetchFunction: typeof fetch,
): Promise<PartialNpmMetadata> {
  const packageResponse = await fetchFunction(
    new URL(packageName, registryUrl).toString(),
    {
      headers: {
        // Corgi format is slightly smaller: https://github.com/npm/pacote/blob/main/lib/registry.js#L71
        accept: isNPM(registryUrl)
          ? 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
          : 'application/json',
      },
    },
  );
  if (!packageResponse.ok) {
    throw new Error(
      `Failed to fetch NPM registry entry. Status code: ${packageResponse.status}.`,
    );
  }
  const packageMetadata = await packageResponse.json();

  if (!isObject(packageMetadata)) {
    throw new Error(
      `Failed to fetch package "${packageName}" metadata from npm.`,
    );
  }

  return packageMetadata as PartialNpmMetadata;
}

/**
 * Gets the canonical base path for an NPM snap.
 *
 * @param registryUrl - A registry URL.
 * @param packageName - A package name.
 * @returns The canonical base path.
 */
export function getNpmCanonicalBasePath(registryUrl: URL, packageName: string) {
  let canonicalBase = 'npm://';
  if (registryUrl.username !== '') {
    canonicalBase += registryUrl.username;
    if (registryUrl.password !== '') {
      canonicalBase += `:${registryUrl.password}`;
    }
    canonicalBase += '@';
  }
  return `${canonicalBase}${registryUrl.host}/${packageName}/`;
}

/**
 * Determine if a registry URL is NPM.
 *
 * @param registryUrl - A registry url.
 * @returns True if the registry is the NPM registry, otherwise false.
 */
function isNPM(registryUrl: URL) {
  return registryUrl.toString() === DEFAULT_NPM_REGISTRY.toString();
}

/**
 * Resolves a version range to a version using the NPM registry.
 *
 * Unless the version range is already a version, then the NPM registry is skipped.
 *
 * @param packageName - The name of the package whose metadata to fetch.
 * @param versionRange - The version range of the package.
 * @param registryUrl - The URL of the npm registry to fetch the metadata from.
 * @param fetchFunction - The fetch function to use. Defaults to the global
 * {@link fetch}. Useful for Node.js compatibility.
 * @returns An object containing the resolved version and a URL for its tarball.
 * @throws If fetching the metadata fails.
 */
async function resolveNpmVersion(
  packageName: string,
  versionRange: SemVerRange,
  registryUrl: URL,
  fetchFunction: typeof fetch,
): Promise<{ tarballURL: string; targetVersion: SemVerVersion }> {
  // If the version range is already a static version we don't need to look for the metadata.
  if (isNPM(registryUrl) && isValidSemVerVersion(versionRange)) {
    return {
      tarballURL: getNpmTarballUrl(packageName, versionRange),
      targetVersion: versionRange,
    };
  }

  const packageMetadata = await fetchNpmMetadata(
    packageName,
    registryUrl,
    fetchFunction,
  );

  const versions = Object.keys(packageMetadata?.versions ?? {}).map(
    (version) => {
      assertIsSemVerVersion(version);
      return version;
    },
  );

  const targetVersion = getTargetVersion(versions, versionRange);

  if (targetVersion === null) {
    throw new Error(
      `Failed to find a matching version in npm metadata for package "${packageName}" and requested semver range "${versionRange}".`,
    );
  }

  const tarballURL = packageMetadata?.versions?.[targetVersion]?.dist?.tarball;

  return { tarballURL, targetVersion };
}

/**
 * The paths of files within npm tarballs appear to always be prefixed with
 * "package/".
 */
const NPM_TARBALL_PATH_PREFIX = /^package\//u;

/**
 * Converts a {@link ReadableStream} to a Node.js {@link Readable}
 * stream. Returns the stream directly if it is already a Node.js stream.
 * We can't use the native Web {@link ReadableStream} directly because the
 * other stream libraries we use expect Node.js streams.
 *
 * @param stream - The stream to convert.
 * @returns The given stream as a Node.js Readable stream.
 */
function getNodeStream(stream: ReadableStream): Readable {
  if (typeof stream.getReader !== 'function') {
    return stream as unknown as Readable;
  }

  return new ReadableWebToNodeStream(stream);
}

/**
 * Creates a `tar-stream` that will get the necessary files from an npm Snap
 * package tarball (`.tgz` file).
 *
 * @param canonicalBase - A base URI as specified in {@link https://github.com/MetaMask/SIPs/blob/main/SIPS/sip-8.md SIP-8}. Starting with 'npm:'. Will be used for canonicalPath vfile argument.
 * @param files - An object to write target file contents to.
 * @returns The {@link Writable} tarball extraction stream.
 */
function createTarballStream(
  canonicalBase: string,
  files: Map<string, VirtualFile>,
): Writable {
  assert(
    canonicalBase.endsWith('/'),
    "Base needs to end with '/' for relative paths to be added as children instead of siblings.",
  );

  assert(
    canonicalBase.startsWith('npm:'),
    'Protocol mismatch, expected "npm:".',
  );
  // `tar-stream` is pretty old-school, so we create it first and then
  // instrument it by adding event listeners.
  const extractStream = tarExtract();

  let totalSize = 0;

  // "entry" is fired for every discrete entity in the tarball. This includes
  // files and folders.
  extractStream.on('entry', (header, entryStream, next) => {
    const { name: headerName, type: headerType } = header;
    if (headerType === 'file') {
      // The name is a path if the header type is "file".
      const path = headerName.replace(NPM_TARBALL_PATH_PREFIX, '');
      return entryStream.pipe(
        concat({ encoding: 'uint8array' }, (data) => {
          try {
            totalSize += data.byteLength;
            // To prevent zip bombs, we set a safety limit for the total size of tarballs.
            assert(
              totalSize < TARBALL_SIZE_SAFETY_LIMIT,
              `Snap tarball exceeds limit of ${TARBALL_SIZE_SAFETY_LIMIT} bytes.`,
            );
            const vfile = new VirtualFile({
              value: data,
              path,
              data: {
                canonicalPath: new URL(path, canonicalBase).toString(),
              },
            });
            // We disallow files having identical paths as it may confuse our checksum calculations.
            assert(
              !files.has(path),
              'Malformed tarball, multiple files with the same path.',
            );
            files.set(path, vfile);
            return next();
          } catch (error) {
            return extractStream.destroy(error);
          }
        }),
      );
    }

    // If we get here, the entry is not a file, and we want to ignore. The entry
    // stream must be drained, or the extractStream will stop reading. This is
    // effectively a no-op for the current entry.
    entryStream.on('end', () => next());
    return entryStream.resume();
  });
  return extractStream;
}
