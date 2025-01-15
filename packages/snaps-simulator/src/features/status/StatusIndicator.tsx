import { Flex, Spinner, Text } from '@chakra-ui/react';
import {
  SnapIdPrefixes,
  getSnapPrefix,
  stripSnapPrefix,
} from '@metamask/snaps-utils';
import { useEffect, useState } from 'react';

import { Icon } from '../../components';
import { useDispatch, useSelector } from '../../hooks';
import { getSnapId, openConfigurationModal } from '../configuration';
import { SnapStatus, getStatus } from '../simulation';

export const StatusIndicator = () => {
  const snapId = useSelector(getSnapId);
  const status = useSelector(getStatus);
  const dispatch = useDispatch();

  const [prettyUrl, setPrettyUrl] = useState(snapId);

  useEffect(() => {
    if (!snapId) {
      return;
    }
    try {
      const stripped = stripSnapPrefix(snapId);
      if (getSnapPrefix(snapId) === SnapIdPrefixes.npm) {
        setPrettyUrl(stripped);
        return;
      }
      const url = new URL(stripped);
      setPrettyUrl(url.host);
    } catch {
      // Ignore.
    }
  }, [snapId]);

  const color =
    // eslint-disable-next-line no-nested-ternary
    status === SnapStatus.Ok
      ? 'text.success'
      : status === SnapStatus.Error
        ? 'text.error'
        : 'info.default';

  const handleClick = () => {
    dispatch(openConfigurationModal());
  };

  return (
    <Flex
      alignItems="center"
      gap="2"
      onClick={handleClick}
      cursor="pointer"
      _hover={{
        p: {
          color,
        },
      }}
    >
      {status === SnapStatus.Ok && (
        <Icon icon="dot" width="8px" data-testid="status-ok" />
      )}
      {status === SnapStatus.Loading && <Spinner color={color} size="xs" />}
      {status === SnapStatus.Error && (
        <Icon icon="errorTriangle" width="16px" data-testid="status-error" />
      )}
      <Text
        fontWeight="500"
        fontSize="sm"
        color="text.muted"
        transition="color ease 0.2s"
      >
        {prettyUrl}
      </Text>
    </Flex>
  );
};
