import { Box, Flex, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { TransactionPrefill } from './TransactionPrefill';
import { TRANSACTION_PRESETS } from '../presets';
import type { TransactionFormData } from '../utils';

export type TransactionPrefillsProps = {
  onClick: (prefill: TransactionFormData) => void;
};

export const TransactionPrefills: FunctionComponent<
  TransactionPrefillsProps
> = ({ onClick }) => (
  <Box marginBottom="4">
    <Text fontWeight="500" fontSize="xs" marginBottom="1">
      Transaction presets
    </Text>
    <Flex gap="2">
      {TRANSACTION_PRESETS.map(({ name, transaction }, index) => (
        <TransactionPrefill
          name={name}
          {...transaction}
          key={`transaction-prefill-${index}`}
          onClick={onClick}
        />
      ))}
    </Flex>
  </Box>
);
