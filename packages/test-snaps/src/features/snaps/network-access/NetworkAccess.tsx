import { logError } from '@metamask/snaps-utils';
import type { ChangeEvent, FunctionComponent } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

import {
  NETWORK_ACCESS_PORT,
  NETWORK_ACCESS_SNAP_ID,
  NETWORK_ACCESS_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const NetworkAccess: FunctionComponent = () => {
  const [url, setUrl] = useState(`${window.location.href}test-data.json`);
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleSubmit = () => {
    invokeSnap({
      snapId: getSnapId(NETWORK_ACCESS_SNAP_ID, NETWORK_ACCESS_PORT),
      method: 'fetch',
      params: { url },
    }).catch(logError);
  };

  return (
    <Snap
      name="Network Access Snap"
      snapId={NETWORK_ACCESS_SNAP_ID}
      port={NETWORK_ACCESS_PORT}
      version={NETWORK_ACCESS_VERSION}
      testId="network-access"
    >
      <Form.Control
        type="text"
        placeholder="URL"
        value={url}
        onChange={handleChange}
        id="fetchUrl"
        className="mb-3"
      />
      <Button
        variant="primary"
        id="sendNetworkAccessTest"
        className="mb-3"
        disabled={isLoading}
        onClick={handleSubmit}
      >
        Fetch
      </Button>
      <Result>
        <span id="networkAccessResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
