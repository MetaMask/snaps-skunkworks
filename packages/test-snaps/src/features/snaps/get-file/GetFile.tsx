import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  GET_FILE_SNAP_ID,
  GET_FILE_SNAP_PORT,
  GET_FILE_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const GetFile: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data }] = useInvokeMutation();
  const snapId = getSnapId(GET_FILE_SNAP_ID, GET_FILE_SNAP_PORT);

  const handleSubmit = () => {
    invokeSnap({
      snapId,
      method: 'getFile',
    }).catch(logError);
  };

  const handleSubmit2 = () => {
    invokeSnap({
      snapId,
      method: 'getFileInBase64',
    }).catch(logError);
  };

  const handleSubmit3 = () => {
    invokeSnap({
      snapId,
      method: 'getFileInHex',
    }).catch(logError);
  };

  return (
    <Snap
      name="Get File Snap"
      snapId={GET_FILE_SNAP_ID}
      port={GET_FILE_SNAP_PORT}
      version={GET_FILE_VERSION}
      testId="getfile"
    >
      <ButtonGroup className="mb-3">
        <Button
          id="sendGetFileTextButton"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          Get Text
        </Button>
        <Button
          id="sendGetFileBase64Button"
          onClick={handleSubmit2}
          disabled={isLoading}
        >
          Get Base64
        </Button>
        <Button
          id="sendGetFileHexButton"
          onClick={handleSubmit3}
          disabled={isLoading}
        >
          Get Hex
        </Button>
      </ButtonGroup>

      <Result>
        <span id="getFileResult">{JSON.stringify(data, null, 2)}</span>
      </Result>
    </Snap>
  );
};
