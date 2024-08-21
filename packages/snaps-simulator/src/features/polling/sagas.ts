import type { SnapLocation } from '@metamask/snaps-controllers';
import { detectSnapLocation } from '@metamask/snaps-controllers';
import type { LocalizationFile, SnapManifest } from '@metamask/snaps-utils';
import {
  getSnapPrefix,
  logError,
  parseJson,
  SnapIdPrefixes,
  VirtualFile,
} from '@metamask/snaps-utils';
import type { SemVerRange } from '@metamask/utils';
import equal from 'fast-deep-equal/es6';
import { all, call, delay, put, select, takeLatest } from 'redux-saga/effects';

import { getSnapId, getSnapVersion, setSnapId } from '../configuration';
import { addDefault, addError } from '../console';
import { ManifestStatus, setValid, validateManifest } from '../manifest';
import {
  getSnapManifest,
  setAuxiliaryFiles,
  setIcon,
  setLocalizationFiles,
  setManifest,
  setSourceCode,
  setStatus,
  SnapStatus,
} from '../simulation';

/**
 * Utility function for fetching auxiliary snap files.
 *
 * @param location - The snap location class.
 * @param manifest - The parsed manifest.
 * @returns The auxiliary files.
 */
async function fetchAuxiliaryFiles(
  location: SnapLocation,
  manifest: SnapManifest,
): Promise<VirtualFile[]> {
  return manifest.source.files
    ? await Promise.all(
        manifest.source.files.map(async (filePath) => location.fetch(filePath)),
      )
    : [];
}

/**
 * Fetch the localization files for the snap.
 *
 * @param location - The snap location.
 * @param manifest - The parsed manifest.
 * @returns The localization files.
 */
async function fetchLocalizationFiles(
  location: SnapLocation,
  manifest: SnapManifest,
): Promise<VirtualFile<LocalizationFile>[]> {
  return manifest.source.locales
    ? await Promise.all(
        manifest.source.locales.map(async (filePath) =>
          location.fetch(filePath).then((file) => {
            return new VirtualFile<LocalizationFile>({
              path: file.path,
              value: file.value,
              result: parseJson<LocalizationFile>(file.toString('utf8')),
              data: {
                canonicalPath: file.data.canonicalPath,
              },
            });
          }),
        ),
      )
    : [];
}

/**
 * The fetching saga, fetches the snap manifest from the selected snap URL and checks if the checksum matches the cached value.
 * If the checksum doesn't match, it fetches the snap source code and updates that in the simulation slice.
 *
 * @yields Selects the snap URL and checksum, calls fetch to fetch the manifest, puts updates to the manifest and source code.
 */
export function* fetchingSaga() {
  const snapId: string = yield select(getSnapId);
  const snapVersion: string = yield select(getSnapVersion);

  const location = detectSnapLocation(snapId, {
    allowLocal: true,
    versionRange: snapVersion as SemVerRange,
  });

  const manifestFile: VirtualFile<SnapManifest> = yield call(
    [location, 'fetch'],
    'snap.manifest.json',
  );

  const parsedManifest = parseJson<SnapManifest>(manifestFile.toString('utf8'));
  manifestFile.result = parsedManifest;

  const currentManifest: SnapManifest = yield select(getSnapManifest);
  if (equal(parsedManifest, currentManifest)) {
    return;
  }

  yield put(setValid(ManifestStatus.Unknown));
  yield put(setStatus(SnapStatus.Loading));
  yield put(setManifest(manifestFile));
  yield put(addDefault('Snap changed, rebooting...'));

  try {
    const bundlePath = parsedManifest.source.location.npm.filePath;
    const bundle: VirtualFile<string> = yield call(
      [location, 'fetch'],
      bundlePath,
    );
    yield put(setSourceCode(bundle));

    const auxiliaryFiles: VirtualFile[] = yield call(
      fetchAuxiliaryFiles,
      location,
      parsedManifest,
    );

    yield put(setAuxiliaryFiles(auxiliaryFiles));

    const localizationFiles: VirtualFile<LocalizationFile>[] = yield call(
      fetchLocalizationFiles,
      location,
      parsedManifest,
    );

    yield put(setLocalizationFiles(localizationFiles));

    const { iconPath } = parsedManifest.source.location.npm;
    if (iconPath) {
      const icon: VirtualFile<string> = yield call(
        [location, 'fetch'],
        iconPath,
      );

      yield put(setIcon(icon));
    }
  } finally {
    yield put(validateManifest(manifestFile));
  }
}

/**
 * The polling saga, runs the fetching saga in an infinite loop with a delay.
 *
 * @yields A call to fetchingSaga and a delay.
 */
export function* pollingSaga() {
  while (true) {
    try {
      const snapId: string = yield select(getSnapId);
      yield call(fetchingSaga);
      if (getSnapPrefix(snapId) !== SnapIdPrefixes.local) {
        break;
      }
      yield delay(500);
    } catch (error: any) {
      logError(error);
      yield put(addError(error));
      yield put(setStatus(SnapStatus.Error));
      yield put(setValid(ManifestStatus.Unknown));
      break;
    }
  }
}

/**
 * The root polling saga which runs all sagas in this file.
 *
 * @yields All sagas for the polling feature.
 */
export function* rootPollingSaga() {
  yield all([takeLatest(setSnapId.type, pollingSaga)]);
}
