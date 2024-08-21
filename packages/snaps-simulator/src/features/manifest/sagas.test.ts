import { expectSaga } from 'redux-saga-test-plan';

import { validationSaga } from './sagas';
import {
  ManifestStatus,
  setResults,
  setValid,
  validateManifest,
} from './slice';
import { MOCK_MANIFEST_FILE } from '../simulation/test/mockManifest';
import {
  MOCK_SNAP_ICON_FILE,
  MOCK_SNAP_SOURCE_FILE,
} from '../simulation/test/mockSnap';

describe('validationSaga', () => {
  it('validates the manifest', async () => {
    await expectSaga(validationSaga, validateManifest(MOCK_MANIFEST_FILE))
      .withState({
        simulation: {
          sourceCode: MOCK_SNAP_SOURCE_FILE,
          icon: MOCK_SNAP_ICON_FILE,
        },
      })
      .call.like({
        args: [
          MOCK_MANIFEST_FILE,
          {
            sourceCode: MOCK_SNAP_SOURCE_FILE,
            icon: MOCK_SNAP_ICON_FILE,
          },
        ],
      })
      .put.actionType(setResults.type)
      .put(setValid(ManifestStatus.Invalid))
      .silentRun();
  });
});
