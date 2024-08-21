import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button } from 'react-bootstrap';

import { ERRORS_SNAP_ID, ERRORS_SNAP_PORT, ERRORS_VERSION } from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const Errors: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleSubmit = () => {
    invokeSnap({
      snapId: getSnapId(ERRORS_SNAP_ID, ERRORS_SNAP_PORT),
      method: 'hello',
    }).catch(logError);
  };

  return (
    <Snap
      name="Errors Snap"
      snapId={ERRORS_SNAP_ID}
      port={ERRORS_SNAP_PORT}
      version={ERRORS_VERSION}
      testId="errors"
    >
      <Button
        variant="primary"
        id="sendError"
        className="mb-3"
        disabled={isLoading}
        onClick={handleSubmit}
      >
        Send Test to Error Snap
      </Button>
      <Result>
        <span id="errorResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
