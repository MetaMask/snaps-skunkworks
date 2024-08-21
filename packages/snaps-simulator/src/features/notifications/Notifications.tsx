import { useToast } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';
import { useEffect } from 'react';

import { getNotifications, removeNotification } from './slice';
import { useDispatch, useSelector } from '../../hooks';

export const Notifications: FunctionComponent = () => {
  const dispatch = useDispatch();
  const notifications = useSelector(getNotifications);
  const toast = useToast();

  useEffect(() => {
    for (const notification of notifications) {
      toast({
        position: 'top',
        description: notification.message,
      });

      dispatch(removeNotification(notification.id));
    }
  }, [notifications, dispatch, toast]);

  return null;
};
