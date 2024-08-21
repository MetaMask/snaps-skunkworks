import { logError } from '@metamask/snaps-utils';
import { type FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  FILE_UPLOAD_SNAP_ID,
  FILE_UPLOAD_SNAP_PORT,
  FILE_UPLOAD_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const FileUpload: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleClick = (method: string) => () => {
    invokeSnap({
      snapId: getSnapId(FILE_UPLOAD_SNAP_ID, FILE_UPLOAD_SNAP_PORT),
      method,
    }).catch(logError);
  };
  return (
    <Snap
      name="File Upload Snap"
      snapId={FILE_UPLOAD_SNAP_ID}
      port={FILE_UPLOAD_SNAP_PORT}
      version={FILE_UPLOAD_VERSION}
      testId="file-upload"
    >
      <ButtonGroup className="mb-3">
        <Button
          variant="primary"
          id="uploadFile"
          disabled={isLoading}
          onClick={handleClick('dialog')}
        >
          Upload File
        </Button>
      </ButtonGroup>
      <Result>
        <span id="file-upload-result">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
