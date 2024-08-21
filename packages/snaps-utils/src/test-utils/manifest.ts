import type { SemVerVersion } from '@metamask/utils';

import type { MakeSemVer } from './common';
import type { LocalizationFile } from '../localization';
import type { SnapManifest } from '../manifest/validation';
import type { Chain, Namespace } from '../namespace';
import { getSnapChecksum } from '../snaps';
import type { NpmSnapPackageJson, SnapFiles } from '../types';
import { VirtualFile } from '../virtual-file';

type GetSnapManifestOptions = Partial<MakeSemVer<SnapManifest>> & {
  shasum?: string;
  filePath?: string;
  packageName?: string;
  registry?: string;
  iconPath?: string;
  files?: string[];
  locales?: string[];
};

type GetPackageJsonOptions = Partial<MakeSemVer<NpmSnapPackageJson>>;

export const DEFAULT_SOURCE_PATH = 'dist/bundle.js';
export const DEFAULT_ICON_PATH = 'images/icon.svg';
export const DEFAULT_MANIFEST_PATH = 'snap.manifest.json';
export const DEFAULT_PACKAGE_JSON_PATH = 'package.json';

export const MOCK_SNAP_NAME = '@metamask/example-snap';
export const MOCK_SNAP_DESCRIPTION = 'The test example snap!';
export const MOCK_SNAP_VERSION = '1.0.0' as SemVerVersion;
/* eslint-disable @typescript-eslint/naming-convention */
export const MOCK_INITIAL_PERMISSIONS = {
  snap_dialog: {},
  'endowment:rpc': { snaps: true, dapps: false },
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Get the default package repository, in a format compatible with
 * `package.json`.
 *
 * @returns The default package repository.
 */
export const getDefaultRepository = () => {
  return {
    type: 'git' as const,
    url: 'https://github.com/MetaMask/example-snap.git',
  };
};

/**
 * A mock snap source and its shasum.
 */
export const DEFAULT_SNAP_BUNDLE = `
  module.exports.onRpcRequest = ({ request }) => {
    console.log("Hello, world!");

    const { method, id } = request;
    return method + id;
  };
`;

export const DEFAULT_SNAP_ICON = '<svg />';

export const MOCK_AUXILIARY_FILE = '{ "foo": "bar" }';

export const ALTERNATIVE_SNAP_ICON =
  '<svg width="24" height="25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.037 0H6.975C2.605 0 0 2.617 0 6.987v10.05c0 4.37 2.605 6.975 6.975 6.975h10.05c4.37 0 6.975-2.605 6.975-6.976V6.988C24.012 2.617 21.407 0 17.037 0ZM11.49 17.757c0 .36-.18.684-.492.876a.975.975 0 0 1-.54.156 1.11 1.11 0 0 1-.469-.108l-4.202-2.1a1.811 1.811 0 0 1-.985-1.61v-3.973c0-.36.18-.685.493-.877a1.04 1.04 0 0 1 1.008-.048l4.202 2.101a1.8 1.8 0 0 1 .997 1.609v3.974h-.012Zm-.252-6.423L6.723 8.896a1.045 1.045 0 0 1-.528-.924c0-.384.204-.744.528-.924l4.515-2.438a1.631 1.631 0 0 1 1.524 0l4.515 2.438c.324.18.528.528.528.924s-.204.744-.528.924l-4.515 2.438c-.24.132-.504.192-.768.192a1.54 1.54 0 0 1-.756-.192Zm7.972 3.638c0 .684-.385 1.308-.997 1.608l-4.202 2.101c-.144.072-.3.108-.468.108a.975.975 0 0 1-.54-.156 1.017 1.017 0 0 1-.493-.876v-3.974c0-.684.384-1.309.997-1.609l4.202-2.101a1.04 1.04 0 0 1 1.008.048c.313.192.493.516.493.877v3.974Z" fill="#24272A"/></svg>';

// This will need to be recalculated if the checksum inputs change.
export const DEFAULT_SNAP_SHASUM =
  'rNyfINgNh161cBmUop+F7xlE+GSEDZH53Y/HDpGLGGg=';
/**
 * Get a mock snap manifest, based on the provided options. This is useful for
 * quickly generating a manifest file, while being able to override any of the
 * values.
 *
 * @param manifest - The optional manifest overrides.
 * @param manifest.version - The version of the snap.
 * @param manifest.description - The description of the snap.
 * @param manifest.proposedName - The proposed name of the snap.
 * @param manifest.initialPermissions - The initial permissions of the snap.
 * @param manifest.shasum - The shasum of the snap.
 * @param manifest.filePath - The path to the snap.
 * @param manifest.packageName - The name of the snap.
 * @param manifest.repository - The repository of the snap.
 * @param manifest.iconPath - The path to the icon of the snap.
 * @param manifest.files - Auxiliary files loaded at runtime by the snap.
 * @param manifest.locales - Localization files of the snap.
 * @param manifest.initialConnections - Initial connections for the snap.
 * @returns The snap manifest.
 */
export const getSnapManifest = ({
  version = MOCK_SNAP_VERSION,
  description = MOCK_SNAP_DESCRIPTION,
  proposedName = MOCK_SNAP_NAME,
  initialPermissions = MOCK_INITIAL_PERMISSIONS,
  shasum = DEFAULT_SNAP_SHASUM,
  filePath = DEFAULT_SOURCE_PATH,
  packageName = MOCK_SNAP_NAME,
  repository = getDefaultRepository(),
  iconPath = DEFAULT_ICON_PATH,
  files = undefined,
  locales = undefined,
  initialConnections = undefined,
}: GetSnapManifestOptions = {}): SnapManifest => {
  return {
    version: version as SemVerVersion,
    description,
    proposedName,
    repository,
    source: {
      shasum,
      location: {
        npm: {
          filePath,
          packageName,
          registry: 'https://registry.npmjs.org',
          iconPath,
        } as const,
      },
      ...(files ? { files } : {}),
      ...(locales ? { locales } : {}),
    },
    ...(initialConnections ? { initialConnections } : {}),
    initialPermissions,
    manifestVersion: '0.1' as const,
  };
};

/**
 * Get a mock `package.json`, based on the provided options. This is useful for
 * quickly generating a `package.json` file, while being able to override any of
 * the values.
 *
 * @param package - The optional `package.json` overrides.
 * @param package.name - The name of the package.
 * @param package.version - The version of the package.
 * @param package.description - The description of the package.
 * @param package.main - The entry point of the package.
 * @param package.repository - The repository of the package.
 * @returns The `package.json` object.
 */
export const getPackageJson = ({
  name = '@metamask/example-snap',
  version = '1.0.0' as SemVerVersion,
  description = 'The test example snap!',
  main = 'src/index.js',
  repository = getDefaultRepository(),
}: GetPackageJsonOptions = {}): NpmSnapPackageJson => {
  return {
    name,
    version: version as SemVerVersion,
    description,
    main,
    repository,
  };
};

export const getMockSnapFiles = ({
  manifest = getSnapManifest(),
  packageJson = getPackageJson(),
  sourceCode = DEFAULT_SNAP_BUNDLE,
  svgIcon = DEFAULT_SNAP_ICON,
  auxiliaryFiles = [],
  localizationFiles = [],
}: {
  manifest?: SnapManifest | VirtualFile<SnapManifest>;
  sourceCode?: string | VirtualFile;
  packageJson?: NpmSnapPackageJson;
  svgIcon?: string | VirtualFile;
  auxiliaryFiles?: VirtualFile[];
  localizationFiles?: LocalizationFile[];
} = {}): SnapFiles => {
  return {
    manifest:
      manifest instanceof VirtualFile
        ? manifest
        : new VirtualFile({
            value: JSON.stringify(manifest),
            result: manifest,
            path: DEFAULT_MANIFEST_PATH,
          }),
    packageJson: new VirtualFile({
      value: JSON.stringify(packageJson),
      result: packageJson,
      path: DEFAULT_PACKAGE_JSON_PATH,
    }),
    sourceCode:
      sourceCode instanceof VirtualFile
        ? sourceCode
        : new VirtualFile({
            value: sourceCode,
            path: DEFAULT_SOURCE_PATH,
          }),
    localizationFiles: localizationFiles.map((file) => {
      return new VirtualFile({
        value: JSON.stringify(file),
        result: file,
        path: `locales/${file.locale}.json`,
      });
    }),
    // eslint-disable-next-line no-nested-ternary
    svgIcon: svgIcon
      ? svgIcon instanceof VirtualFile
        ? svgIcon
        : new VirtualFile({
            value: svgIcon,
            path: DEFAULT_ICON_PATH,
          })
      : undefined,
    auxiliaryFiles,
  };
};

export const getMockSnapFilesWithUpdatedChecksum = async ({
  manifest = getSnapManifest(),
  packageJson = getPackageJson(),
  sourceCode = DEFAULT_SNAP_BUNDLE,
  svgIcon = DEFAULT_SNAP_ICON,
  auxiliaryFiles = [],
  localizationFiles = [],
}: {
  manifest?: SnapManifest | VirtualFile<SnapManifest>;
  sourceCode?: string | VirtualFile;
  packageJson?: NpmSnapPackageJson;
  svgIcon?: string | VirtualFile;
  auxiliaryFiles?: VirtualFile[];
  localizationFiles?: LocalizationFile[];
} = {}): Promise<SnapFiles> => {
  const files = getMockSnapFiles({
    manifest,
    packageJson,
    sourceCode,
    svgIcon,
    auxiliaryFiles,
    localizationFiles,
  });

  files.manifest.result.source.shasum = await getSnapChecksum(files);
  files.manifest.value = JSON.stringify(files.manifest.result);

  return files;
};

export const getChain = ({
  id = 'eip155:1',
  name = 'Ethereum Mainnet',
}: Partial<Chain> = {}): Chain => ({
  id,
  name,
});

export const getNamespace = ({
  chains = [getChain()],
  methods = ['eth_signTransaction', 'eth_accounts'],
  events = ['accountsChanged'],
}: Partial<Namespace> = {}): Namespace => ({
  chains,
  methods,
  events,
});

export const getMockLocalizationFile = ({
  locale = 'en',
  messages = {
    proposedName: {
      message: 'Example Snap',
    },
  },
}: Partial<LocalizationFile> = {}): LocalizationFile => {
  return {
    locale,
    messages,
  };
};
