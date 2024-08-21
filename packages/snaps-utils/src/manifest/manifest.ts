import { getErrorMessage } from '@metamask/snaps-sdk';
import type { Json } from '@metamask/utils';
import { assert, isPlainObject } from '@metamask/utils';
import { promises as fs } from 'fs';
import pathUtils from 'path';

import type { SnapManifest } from './validation';
import type { ValidatorResults } from './validator';
import { hasFixes, runValidators } from './validator';
import type { ValidatorMeta, ValidatorReport } from './validator-types';
import { deepClone } from '../deep-clone';
import { readJsonFile } from '../fs';
import { parseJson } from '../json';
import type { SnapFiles, UnvalidatedSnapFiles } from '../types';
import { NpmSnapFileNames } from '../types';
import { readVirtualFile, VirtualFile } from '../virtual-file/node';

const MANIFEST_SORT_ORDER: Record<keyof SnapManifest, number> = {
  $schema: 1,
  version: 2,
  description: 3,
  proposedName: 4,
  repository: 5,
  source: 6,
  initialConnections: 7,
  initialPermissions: 8,
  manifestVersion: 9,
};

export type CheckManifestReport = Omit<ValidatorReport, 'fix'> & {
  wasFixed?: boolean;
};

/**
 * The result from the `checkManifest` function.
 *
 * @property manifest - The fixed manifest object.
 * @property updated - Whether the manifest was written and updated.
 */
export type CheckManifestResult = {
  files?: SnapFiles;
  updated: boolean;
  reports: CheckManifestReport[];
};

export type WriteFileFunction = (path: string, data: string) => Promise<void>;

/**
 * Validates a snap.manifest.json file. Attempts to fix the manifest and write
 * the fixed version to disk if `writeManifest` is true. Throws if validation
 * fails.
 *
 * @param basePath - The path to the folder with the manifest files.
 * @param options - Additional options for the function.
 * @param options.sourceCode - The source code of the Snap.
 * @param options.writeFileFn - The function to use to write the manifest to disk.
 * @param options.updateAndWriteManifest - Whether to auto-magically try to fix errors and then write the manifest to disk.
 * @returns Whether the manifest was updated, and an array of warnings that
 * were encountered during processing of the manifest files.
 */
export async function checkManifest(
  basePath: string,
  {
    updateAndWriteManifest = true,
    sourceCode,
    writeFileFn = fs.writeFile,
  }: {
    updateAndWriteManifest?: boolean;
    sourceCode?: string;
    writeFileFn?: WriteFileFunction;
  } = {},
): Promise<CheckManifestResult> {
  const manifestPath = pathUtils.join(basePath, NpmSnapFileNames.Manifest);
  const manifestFile = await readJsonFile(manifestPath);
  const unvalidatedManifest = manifestFile.result;

  const packageFile = await readJsonFile(
    pathUtils.join(basePath, NpmSnapFileNames.PackageJson),
  );

  const auxiliaryFilePaths = getSnapFilePaths(
    unvalidatedManifest,
    (manifest) => manifest?.source?.files,
  );

  const localizationFilePaths = getSnapFilePaths(
    unvalidatedManifest,
    (manifest) => manifest?.source?.locales,
  );
  const localizationFiles =
    (await getSnapFiles(basePath, localizationFilePaths)) ?? [];
  for (const localization of localizationFiles) {
    try {
      localization.result = parseJson(localization.toString());
    } catch (error) {
      assert(error instanceof SyntaxError, error);
      throw new Error(
        `Failed to parse localization file "${localization.path}" as JSON.`,
      );
    }
  }

  const snapFiles: UnvalidatedSnapFiles = {
    manifest: manifestFile,
    packageJson: packageFile,
    sourceCode: await getSnapSourceCode(
      basePath,
      unvalidatedManifest,
      sourceCode,
    ),
    svgIcon: await getSnapIcon(basePath, unvalidatedManifest),
    // Intentionally pass null as the encoding here since the files may be binary
    auxiliaryFiles:
      (await getSnapFiles(basePath, auxiliaryFilePaths, null)) ?? [],
    localizationFiles,
  };

  const validatorResults = await runValidators(snapFiles);
  let manifestResults: CheckManifestResult = {
    updated: false,
    files: validatorResults.files,
    reports: validatorResults.reports,
  };

  if (updateAndWriteManifest && hasFixes(manifestResults)) {
    const fixedResults = await runFixes(validatorResults);

    if (fixedResults.updated) {
      manifestResults = fixedResults;

      assert(manifestResults.files);

      try {
        await writeFileFn(
          pathUtils.join(basePath, NpmSnapFileNames.Manifest),
          manifestResults.files.manifest.toString(),
        );
      } catch (error) {
        // Note: This error isn't pushed to the errors array, because it's not an
        // error in the manifest itself.
        throw new Error(
          `Failed to update "snap.manifest.json": ${getErrorMessage(error)}`,
        );
      }
    }
  }

  return manifestResults;
}

/**
 * Run the algorithm for automatically fixing errors in manifest.
 *
 * The algorithm updates the manifest by fixing all fixable problems,
 * and then run validation again to check if the new manifest is now correct.
 * If not correct, the algorithm will use the manifest from previous iteration
 * and try again `MAX_ATTEMPTS` times to update it before bailing and
 * resulting in failure.
 *
 * @param results - Results of the initial run of validation.
 * @param rules - Optional list of rules to run the fixes with.
 * @returns The result of the fix operation.
 */
export async function runFixes(
  results: ValidatorResults,
  rules?: ValidatorMeta[],
): Promise<CheckManifestResult> {
  let shouldRunFixes = true;
  const MAX_ATTEMPTS = 10;

  assert(results.files);

  let fixResults: ValidatorResults = results;
  assert(fixResults.files);
  fixResults.files.manifest = fixResults.files.manifest.clone();

  for (
    let attempts = 1;
    shouldRunFixes && attempts <= MAX_ATTEMPTS;
    attempts++
  ) {
    assert(fixResults.files);

    let manifest = fixResults.files.manifest.result;

    const fixable = fixResults.reports.filter((report) => report.fix);
    for (const report of fixable) {
      assert(report.fix);
      ({ manifest } = await report.fix({ manifest }));
    }

    fixResults.files.manifest.value = `${JSON.stringify(
      getWritableManifest(manifest),
      null,
      2,
    )}\n`;
    fixResults.files.manifest.result = manifest;

    fixResults = await runValidators(fixResults.files, rules);
    shouldRunFixes = hasFixes(fixResults);
  }

  const initialReports: (CheckManifestReport & ValidatorReport)[] = deepClone(
    results.reports,
  );

  // Was fixed
  if (!shouldRunFixes) {
    for (const report of initialReports) {
      if (report.fix) {
        report.wasFixed = true;
        delete report.fix;
      }
    }

    return {
      files: fixResults.files,
      updated: true,
      reports: initialReports,
    };
  }

  for (const report of initialReports) {
    delete report.fix;
  }

  return {
    files: results.files,
    updated: false,
    reports: initialReports,
  };
}

/**
 * Given an unvalidated Snap manifest, attempts to extract the location of the
 * bundle source file location and read the file.
 *
 * @param basePath - The path to the folder with the manifest files.
 * @param manifest - The unvalidated Snap manifest file contents.
 * @param sourceCode - Override source code for plugins.
 * @returns The contents of the bundle file, if any.
 */
export async function getSnapSourceCode(
  basePath: string,
  manifest: Json,
  sourceCode?: string,
): Promise<VirtualFile | undefined> {
  if (!isPlainObject(manifest)) {
    return undefined;
  }

  const sourceFilePath = (manifest as Partial<SnapManifest>).source?.location
    ?.npm?.filePath;

  if (!sourceFilePath) {
    return undefined;
  }

  if (sourceCode) {
    return new VirtualFile({
      path: pathUtils.join(basePath, sourceFilePath),
      value: sourceCode,
    });
  }

  try {
    const virtualFile = await readVirtualFile(
      pathUtils.join(basePath, sourceFilePath),
      'utf8',
    );
    return virtualFile;
  } catch (error) {
    throw new Error(
      `Failed to read snap bundle file: ${getErrorMessage(error)}`,
    );
  }
}

/**
 * Given an unvalidated Snap manifest, attempts to extract the location of the
 * icon and read the file.
 *
 * @param basePath - The path to the folder with the manifest files.
 * @param manifest - The unvalidated Snap manifest file contents.
 * @returns The contents of the icon, if any.
 */
export async function getSnapIcon(
  basePath: string,
  manifest: Json,
): Promise<VirtualFile | undefined> {
  if (!isPlainObject(manifest)) {
    return undefined;
  }

  const iconPath = (manifest as Partial<SnapManifest>).source?.location?.npm
    ?.iconPath;

  if (!iconPath) {
    return undefined;
  }

  try {
    const virtualFile = await readVirtualFile(
      pathUtils.join(basePath, iconPath),
      'utf8',
    );
    return virtualFile;
  } catch (error) {
    throw new Error(`Failed to read snap icon file: ${getErrorMessage(error)}`);
  }
}

/**
 * Get an array of paths from an unvalidated Snap manifest.
 *
 * @param manifest - The unvalidated Snap manifest file contents.
 * @param selector - A function that returns the paths to the files.
 * @returns The paths to the files, if any.
 */
export function getSnapFilePaths(
  manifest: Json,
  selector: (manifest: Partial<SnapManifest>) => string[] | undefined,
) {
  if (!isPlainObject(manifest)) {
    return undefined;
  }

  const snapManifest = manifest as Partial<SnapManifest>;
  const paths = selector(snapManifest);

  if (!Array.isArray(paths)) {
    return undefined;
  }

  return paths;
}

/**
 * Given an unvalidated Snap manifest, attempts to extract the files with the
 * given paths and read them.
 *
 * @param basePath - The path to the folder with the manifest files.
 * @param paths - The paths to the files.
 * @param encoding - An optional encoding to pass down to readVirtualFile.
 * @returns A list of auxiliary files and their contents, if any.
 */
export async function getSnapFiles(
  basePath: string,
  paths: string[] | undefined,
  encoding: BufferEncoding | null = 'utf8',
): Promise<VirtualFile[] | undefined> {
  if (!paths) {
    return undefined;
  }

  try {
    return await Promise.all(
      paths.map(async (filePath) =>
        readVirtualFile(pathUtils.join(basePath, filePath), encoding),
      ),
    );
  } catch (error) {
    throw new Error(`Failed to read snap files: ${getErrorMessage(error)}`);
  }
}

/**
 * Sorts the given manifest in our preferred sort order and removes the
 * `repository` field if it is falsy (it may be `null`).
 *
 * @param manifest - The manifest to sort and modify.
 * @returns The disk-ready manifest.
 */
export function getWritableManifest(manifest: SnapManifest): SnapManifest {
  const { repository, ...remaining } = manifest;

  const keys = Object.keys(
    repository ? { ...remaining, repository } : remaining,
  ) as (keyof SnapManifest)[];

  const writableManifest = keys
    .sort((a, b) => MANIFEST_SORT_ORDER[a] - MANIFEST_SORT_ORDER[b])
    .reduce<Partial<SnapManifest>>(
      (result, key) => ({
        ...result,
        [key]: manifest[key],
      }),
      {},
    );

  return writableManifest as SnapManifest;
}
