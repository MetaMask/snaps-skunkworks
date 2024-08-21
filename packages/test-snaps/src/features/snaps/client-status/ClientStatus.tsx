import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button } from 'react-bootstrap';

import {
  CLIENT_STATUS_SNAP_ID,
  CLIENT_STATUS_SNAP_PORT,
  CLIENT_STATUS_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const ClientStatus: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleSubmit = () => {
    invokeSnap({
      snapId: getSnapId(CLIENT_STATUS_SNAP_ID, CLIENT_STATUS_SNAP_PORT),
      method: 'status',
    }).catch(logError);
  };

  return (
    <Snap
      name="Client Status Snap"
      snapId={CLIENT_STATUS_SNAP_ID}
      port={CLIENT_STATUS_SNAP_PORT}
      version={CLIENT_STATUS_VERSION}
      testId="client-status"
    >
      <Button
        variant="primary"
        id="sendClientStatusTest"
        className="mb-3"
        disabled={isLoading}
        onClick={handleSubmit}
      >
        Submit
      </Button>
      <Result>
        <span id="clientStatusResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
