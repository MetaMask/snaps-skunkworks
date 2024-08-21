import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  NOTIFICATIONS_SNAP_ID,
  NOTIFICATIONS_SNAP_PORT,
  NOTIFICATIONS_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const Notifications: FunctionComponent = () => {
  const [invokeSnap, { isLoading }] = useInvokeMutation();

  const handleClick = (method: string) => () => {
    invokeSnap({
      snapId: getSnapId(NOTIFICATIONS_SNAP_ID, NOTIFICATIONS_SNAP_PORT),
      method,
    }).catch(logError);
  };

  return (
    <Snap
      name="Notifications Snap"
      snapId={NOTIFICATIONS_SNAP_ID}
      port={NOTIFICATIONS_SNAP_PORT}
      version={NOTIFICATIONS_VERSION}
      testId="notifications"
    >
      <ButtonGroup>
        <Button
          variant="primary"
          id="sendInAppNotification"
          disabled={isLoading}
          onClick={handleClick('inApp')}
        >
          Send In-App Notification
        </Button>
        <Button
          variant="secondary"
          id="sendNativeNotification"
          disabled={isLoading}
          onClick={handleClick('native')}
        >
          Send Native Notification
        </Button>
      </ButtonGroup>
    </Snap>
  );
};
