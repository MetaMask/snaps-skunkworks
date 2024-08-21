import { Box, Flex, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import type { CronjobData } from './CronjobPrefill';
import { CronjobPrefill } from './CronjobPrefill';
import { useSelector } from '../../../../hooks';
import { getSnapManifest } from '../../../simulation';

export type CronjobPrefillsProps = {
  onClick: (prefill: CronjobData) => void;
};

export const CronjobPrefills: FunctionComponent<CronjobPrefillsProps> = ({
  onClick,
}) => {
  const manifest = useSelector(getSnapManifest);
  const jobs = manifest?.initialPermissions?.['endowment:cronjob']?.jobs;

  if (!jobs?.length) {
    return null;
  }

  return (
    <Box marginBottom="4">
      <Text fontWeight="500" fontSize="xs" marginBottom="1">
        Manifest cronjobs
      </Text>
      <Flex gap="2">
        {jobs.map(({ request: { method, params } }, index) => (
          <CronjobPrefill
            key={`cronjob-prefill-${index}`}
            method={method}
            params={params}
            onClick={onClick}
          />
        ))}
      </Flex>
    </Box>
  );
};
