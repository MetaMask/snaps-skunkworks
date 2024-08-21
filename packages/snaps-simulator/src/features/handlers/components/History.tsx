import { Center, Heading, List, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { HistoryItem } from './HistoryItem';
import { Icon } from '../../../components';
import { useHandler, useSelector } from '../../../hooks';

export const History: FunctionComponent = () => {
  const handler = useHandler();
  const history = useSelector((state) => state[handler].history);
  const sortedHistory = [...history].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  if (sortedHistory.length === 0) {
    return (
      <Center
        background="background.alternative"
        flex="1"
        flexDirection="column"
      >
        <Icon icon="moon" width="34px" height="auto" marginBottom="1.5" />
        <Heading
          as="h3"
          fontSize="sm"
          fontWeight="700"
          color="text.muted"
          marginBottom="1"
        >
          No history yet
        </Heading>
        <Text fontSize="xs" textAlign="center" color="text.muted">
          Create a request via the
          <br />
          request tab to get started.
        </Text>
      </Center>
    );
  }

  return (
    <List>
      {sortedHistory.map((item, index) => (
        <HistoryItem item={item} key={`history-item-${index}`} />
      ))}
    </List>
  );
};
