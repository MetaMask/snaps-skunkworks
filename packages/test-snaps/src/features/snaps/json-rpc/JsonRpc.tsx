import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button } from 'react-bootstrap';

import {
  JSON_RPC_SNAP_ID,
  JSON_RPC_SNAP_PORT,
  JSON_RPC_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const JsonRpc: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleSubmit = () => {
    invokeSnap({
      snapId: getSnapId(JSON_RPC_SNAP_ID, JSON_RPC_SNAP_PORT),
      method: 'invokeSnap',
    }).catch(logError);
  };

  return (
    <Snap
      name="JSON-RPC Snap"
      snapId={JSON_RPC_SNAP_ID}
      port={JSON_RPC_SNAP_PORT}
      version={JSON_RPC_VERSION}
      testId="json-rpc"
    >
      <Button
        variant="primary"
        id="sendRpc"
        className="mb-3"
        disabled={isLoading}
        onClick={handleSubmit}
      >
        Invoke Snap
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
