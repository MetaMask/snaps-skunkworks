import { Text } from '@chakra-ui/react';

import { ConsoleEntryType, getConsoleEntries } from './slice';
import { useSelector } from '../../hooks';

export const ConsoleContent = () => {
  const entries = useSelector(getConsoleEntries);

  const colors = {
    [ConsoleEntryType.Log]: 'text.console',
    [ConsoleEntryType.Error]: 'text.error',
  };

  return (
    <>
      {entries.map((entry) => (
        <Text
          textColor={colors[entry.type]}
          fontFamily="code"
          fontSize="xs"
          key={entry.date}
          whiteSpace="pre-wrap"
        >
          {entry.message}
        </Text>
      ))}
    </>
  );
};
