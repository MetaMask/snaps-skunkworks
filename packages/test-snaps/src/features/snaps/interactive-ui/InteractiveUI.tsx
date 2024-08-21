import { logError } from '@metamask/snaps-utils';
import { type FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  INTERACTIVE_UI_SNAP_ID,
  INTERACTIVE_UI_SNAP_PORT,
  INTERACTIVE_UI_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const InteractiveUI: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleClick = (method: string) => () => {
    invokeSnap({
      snapId: getSnapId(INTERACTIVE_UI_SNAP_ID, INTERACTIVE_UI_SNAP_PORT),
      method,
    }).catch(logError);
  };
  return (
    <Snap
      name="Interactive UI Snap"
      snapId={INTERACTIVE_UI_SNAP_ID}
      port={INTERACTIVE_UI_SNAP_PORT}
      version={INTERACTIVE_UI_VERSION}
      testId="interactive-ui"
    >
      <ButtonGroup className="mb-3">
        <Button
          variant="primary"
          id="createDialogButton"
          disabled={isLoading}
          onClick={handleClick('dialog')}
        >
          Create Dialog
        </Button>
        <Button
          variant="primary"
          id="getInterfaceStateButton"
          onClick={handleClick('getState')}
        >
          Get interface state
        </Button>
      </ButtonGroup>
      <Result>
        <span id="interactiveUIResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
