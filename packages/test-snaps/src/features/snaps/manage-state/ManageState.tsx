import type { FunctionComponent } from 'react';

import { ClearData, SendData } from './components';
import {
  MANAGE_STATE_SNAP_ID,
  MANAGE_STATE_PORT,
  MANAGE_STATE_VERSION,
} from './constants';
import { useSnapState } from './hooks';
import { Result, Snap } from '../../../components';

export const ManageState: FunctionComponent = () => {
  const encryptedState = useSnapState(true);
  const unencryptedState = useSnapState(false);

  return (
    <Snap
      name="Manage State Snap"
      snapId={MANAGE_STATE_SNAP_ID}
      port={MANAGE_STATE_PORT}
      version={MANAGE_STATE_VERSION}
      testId="manage-state"
    >
      <Result className="mb-3">
        <span id="retrieveManageStateResult">
          {JSON.stringify(encryptedState, null, 2)}
        </span>
      </Result>

      <SendData encrypted={true} />
      <ClearData encrypted={true} />

      <Result className="mb-3">
        <span id="retrieveManageStateUnencryptedResult">
          {JSON.stringify(unencryptedState, null, 2)}
        </span>
      </Result>

      <SendData encrypted={false} />
      <ClearData encrypted={false} />
    </Snap>
  );
};
