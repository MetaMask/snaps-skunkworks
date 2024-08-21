import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  UPDATES_SNAP_ID,
  UPDATES_SNAP_NEW_VERSION,
  UPDATES_SNAP_OLD_VERSION,
} from './constants';
import { useGetSnapsQuery, useInstallSnapMutation } from '../../../api';
import { Result, Snap } from '../../../components';

export const Updates: FunctionComponent = () => {
  const [installSnap, { isLoading }] = useInstallSnapMutation();
  const { data: snaps } = useGetSnapsQuery();

  const currentVersion = snaps?.[UPDATES_SNAP_ID]?.version;

  const handleUpdate = () => {
    installSnap({
      snapId: UPDATES_SNAP_ID,
      version: UPDATES_SNAP_NEW_VERSION,
    }).catch(logError);
  };

  return (
    <Snap
      name="Update Snap"
      snapId={UPDATES_SNAP_ID}
      version={UPDATES_SNAP_OLD_VERSION}
      testId="Update"
    >
      <Result className="mb-3">
        <span id="updateSnapVersion">
          {JSON.stringify(currentVersion, null, 2)}
        </span>
      </Result>

      <ButtonGroup>
        <Button
          disabled={isLoading}
          onClick={handleUpdate}
          id="connectUpdateNew"
        >
          Update Snap
        </Button>
      </ButtonGroup>
    </Snap>
  );
};
