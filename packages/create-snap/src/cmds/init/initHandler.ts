// eslint-disable-next-line import-x/no-extraneous-dependencies
import cliPackageJson from '@metamask/create-snap/package.json';
import type { NpmSnapPackageJson } from '@metamask/snaps-utils';
import {
  NpmSnapFileNames,
  readJsonFile,
  createSnapManifest,
  logInfo,
} from '@metamask/snaps-utils/node';
import { promises as fs } from 'fs';
import pathUtils from 'path';
import type { SemVer } from 'semver';
import semver from 'semver';

import {
  buildSnap,
  cloneTemplate,
  gitInitWithCommit,
  isGitInstalled,
  isInGitRepository,
  prepareWorkingDirectory,
  SNAP_LOCATION,
  yarnInstall,
} from './initUtils';
import type { YargsArgs } from '../../types/yargs';

/**
 * Creates a new snap package, based on one of the provided templates. This
 * creates all the necessary files, like `package.json`, `snap.config.js`, etc.
 * to start developing a snap.
 *
 * @param argv - The Yargs arguments object.
 * @returns The Yargs arguments augmented with the new `dist`, `outfileName` and
 * `src` properties.
 * @throws If initialization of the snap package failed.
 */
export async function initHandler(argv: YargsArgs) {
  const { directory } = argv;

  const versionRange = cliPackageJson.engines.node;
  const minimumVersion = (semver.minVersion(versionRange) as SemVer).format();

  const isVersionSupported = semver.satisfies(process.version, versionRange);

  if (!isVersionSupported) {
    throw new Error(
      `Init Error: You are using an outdated version of Node (${process.version}). Please update to Node ${minimumVersion} or later.`,
    );
  }

  const gitExists = isGitInstalled();
  if (!gitExists) {
    throw new Error(
      `Init Error: git is not installed. Please install git to continue.`,
    );
  }

  const directoryToUse = directory
    ? pathUtils.resolve(process.cwd(), directory)
    : process.cwd();

  logInfo(`Preparing ${directoryToUse}...`);

  await prepareWorkingDirectory(directoryToUse);

  try {
    logInfo(`Cloning template...`);
    cloneTemplate(directoryToUse);

    await fs.rm(pathUtils.join(directoryToUse, '.git'), {
      force: true,
      recursive: true,
    });
  } catch (error) {
    throw new Error('Init Error: Failed to create template.');
  }

  logInfo('Installing dependencies...');
  yarnInstall(directoryToUse);

  if (!isInGitRepository(directoryToUse)) {
    logInfo('Initializing git repository...');
    gitInitWithCommit(directoryToUse);
  }

  const snapLocation = pathUtils.join(directoryToUse, SNAP_LOCATION);

  logInfo('Running initial build...');
  buildSnap(snapLocation);

  const manifest = (
    await readJsonFile(pathUtils.join(snapLocation, NpmSnapFileNames.Manifest))
  ).result;

  const validatedManifest = createSnapManifest(manifest);

  const packageJson = (
    await readJsonFile(
      pathUtils.join(snapLocation, NpmSnapFileNames.PackageJson),
    )
  ).result as NpmSnapPackageJson;

  const distPath = validatedManifest.source.location.npm.filePath.split('/');

  return {
    ...argv,
    dist: distPath[0],
    outfileName: distPath[1],
    src: packageJson.main || 'src/index.js',
    snapLocation,
  };
}
