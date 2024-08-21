import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  LOCALIZATION_SNAP_ID,
  LOCALIZATION_SNAP_PORT,
  LOCALIZATION_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const Localization: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data }] = useInvokeMutation();
  const snapId = getSnapId(LOCALIZATION_SNAP_ID, LOCALIZATION_SNAP_PORT);

  const handleSubmit = () => {
    invokeSnap({
      snapId,
      method: 'hello',
    }).catch(logError);
  };

  return (
    <Snap
      name="Localization Snap"
      snapId={LOCALIZATION_SNAP_ID}
      port={LOCALIZATION_SNAP_PORT}
      version={LOCALIZATION_VERSION}
      testId="getlocale"
    >
      <ButtonGroup className="mb-3">
        <Button
          id="sendGetLocaleHelloButton"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          Submit
        </Button>
      </ButtonGroup>

      <Result>
        <span id="getLocaleResult">{JSON.stringify(data, null, 2)}</span>
      </Result>
    </Snap>
  );
};
