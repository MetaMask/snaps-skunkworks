import { Center, Heading, List, Text } from '@chakra-ui/react';
import type { FunctionComponent } from 'react';

import { Item } from './Item';
import { Icon } from '../../../components';
import { useSelector } from '../../../hooks';
import { getSnapManifest } from '../../simulation';
import { getManifestResults } from '../slice';

export const Validation: FunctionComponent = () => {
  const manifest = useSelector(getSnapManifest);
  const results = useSelector(getManifestResults);

  if (!manifest) {
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
          Manifest can&apos;t be found
        </Heading>
        <Text fontSize="xs" textAlign="center" color="text.muted">
          Make sure you’re connected to the snap
          <br />
          and have a <i>snap.manifest.json</i>
          <br />
          file in the root of your repository.
        </Text>
      </Center>
    );
  }

  return (
    <List>
      {results.map(({ name, manifestName, isValid, message }) => (
        <Item
          key={name}
          name={name}
          manifestName={manifestName}
          isValid={isValid}
          message={message}
        />
      ))}
    </List>
  );
};
