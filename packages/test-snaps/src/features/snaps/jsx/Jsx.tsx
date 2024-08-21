import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button } from 'react-bootstrap';

import { JSX_SNAP_ID, JSX_SNAP_PORT, JSX_VERSION } from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const Jsx: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleSubmit = () => {
    invokeSnap({
      snapId: getSnapId(JSX_SNAP_ID, JSX_SNAP_PORT),
      method: 'display',
    }).catch(logError);
  };

  return (
    <Snap
      name="JSX Snap"
      snapId={JSX_SNAP_ID}
      port={JSX_SNAP_PORT}
      version={JSX_VERSION}
      testId="jsx"
    >
      <Button
        variant="primary"
        id="displayJsx"
        className="mb-3"
        disabled={isLoading}
        onClick={handleSubmit}
      >
        Show JSX dialog
      </Button>
      <Result>
        <span id="rpcResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
