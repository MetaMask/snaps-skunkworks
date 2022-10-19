import { promises as fs } from 'fs';
import pathUtils from 'path';
import { ncp } from 'ncp';
import {
  NpmSnapFileNames,
  SnapManifest,
  getSnapSourceShasum,
  getWritableManifest,
  readJsonFile,
  satisfiesVersionRange,
} from '@metamask/snap-utils';
import { YargsArgs } from '../../types/yargs';
import { closePrompt } from '../../utils';
import {
  cloneTemplate,
  createTemporaryDirectory,
  isGitInstalled,
  prepareWorkingDirectory,
  TEMPLATE_FOLDER_NAME,
} from './initUtils';

const SATISFIED_VERSION = '>=16';

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

  const isVersionSupported = satisfiesVersionRange(
    process.version,
    SATISFIED_VERSION,
  );

  if (!isVersionSupported) {
    console.error(
      `Init Error: You are using an outdated version of Node (${process.version}). Please update to Node ${SATISFIED_VERSION}.`,
    );
  }

  const gitExists = isGitInstalled();

  if (!gitExists) {
    console.error(
      `Init Error: git is not installed. Please intall git to continue.`,
    );
  }

  const directoryToUse = directory
    ? pathUtils.join(process.cwd(), directory)
    : process.cwd();

  await prepareWorkingDirectory(directoryToUse);

  const tmpDir = await createTemporaryDirectory();

  try {
    await cloneTemplate(tmpDir);
    ncp(pathUtils.join(tmpDir, TEMPLATE_FOLDER_NAME), directoryToUse, {
      // @ts-expect-error wrong type
      filter: (fileName: string) => !fileName.match(/.git/u),
    });
  } catch (err) {
    console.error('Init error: Failed to copy template');
  } finally {
    if (tmpDir) {
      fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
  return { ...argv };
}

/**
 * This updates the Snap shasum value of the manifest after building the Snap
 * during the init command.
 */
export async function updateManifestShasum() {
  const manifest = await readJsonFile<SnapManifest>(NpmSnapFileNames.Manifest);

  const bundleContents = await fs.readFile(
    manifest.source.location.npm.filePath,
    'utf8',
  );

  manifest.source.shasum = getSnapSourceShasum(bundleContents);
  await fs.writeFile(
    NpmSnapFileNames.Manifest,
    JSON.stringify(getWritableManifest(manifest), null, 2),
  );
}
