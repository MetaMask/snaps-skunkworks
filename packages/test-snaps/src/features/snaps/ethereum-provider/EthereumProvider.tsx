import { logError } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import { SignMessage } from './components/SignMessage';
import {
  ETHEREUM_PROVIDER_SNAP_ID,
  ETHEREUM_PROVIDER_SNAP_PORT,
  ETHEREUM_PROVIDER_VERSION,
} from './constants';
import { useInvokeMutation } from '../../../api';
import { Result, Snap } from '../../../components';
import { getSnapId } from '../../../utils';

export const EthereumProvider: FunctionComponent = () => {
  const [invokeSnap, { isLoading, data, error }] = useInvokeMutation();

  const handleSubmit = (method: string) => {
    invokeSnap({
      snapId: getSnapId(ETHEREUM_PROVIDER_SNAP_ID, ETHEREUM_PROVIDER_SNAP_PORT),
      method,
    }).catch(logError);
  };

  const handleGetVersion = () => handleSubmit('getVersion');
  const handleGetAccounts = () => handleSubmit('getAccounts');

  return (
    <Snap
      name="Ethereum Provider Snap"
      snapId={ETHEREUM_PROVIDER_SNAP_ID}
      port={ETHEREUM_PROVIDER_SNAP_PORT}
      version={ETHEREUM_PROVIDER_VERSION}
      testId="ethereum-provider"
    >
      <ButtonGroup>
        <Button
          variant="secondary"
          id="sendEthprovider"
          className="mb-3"
          disabled={isLoading}
          onClick={handleGetVersion}
        >
          Get Version
        </Button>
        <Button
          variant="primary"
          id="sendEthproviderAccounts"
          className="mb-3"
          disabled={isLoading}
          onClick={handleGetAccounts}
        >
          Get Accounts
        </Button>
      </ButtonGroup>
      <Result className="mb-3">
        <span id="ethproviderResult">
          {JSON.stringify(data, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
      <SignMessage />
    </Snap>
  );
};
