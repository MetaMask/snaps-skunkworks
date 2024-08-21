import { logError } from '@metamask/snaps-utils';
import { assert } from '@metamask/utils';
import type { FunctionComponent } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

import {
  TRANSACTION_INSIGHTS_SNAP_ID,
  TRANSACTION_INSIGHTS_SNAP_PORT,
  TRANSACTION_INSIGHTS_VERSION,
} from './constants';
import { useLazyGetAccountsQuery, useLazyRequestQuery } from '../../../api';
import { Snap, Result } from '../../../components';

export const TransactionInsights: FunctionComponent = () => {
  const [getAccounts, { isLoading: isLoadingAccounts, data: accounts }] =
    useLazyGetAccountsQuery();
  const [request, { isLoading: isLoadingRequest, data: transaction, error }] =
    useLazyRequestQuery();

  const isLoading = isLoadingAccounts || isLoadingRequest;

  const handleGetAccounts = () => {
    getAccounts().catch(logError);
  };

  const handleSendTransaction = () => {
    assert(accounts?.length);

    const account = accounts[0];
    request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: account,
          to: account,
          value: '0x0',
          data: '0xa9059cbb00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        },
      ],
    }).catch(logError);
  };

  return (
    <Snap
      name="Transaction Insights Snap"
      snapId={TRANSACTION_INSIGHTS_SNAP_ID}
      port={TRANSACTION_INSIGHTS_SNAP_PORT}
      version={TRANSACTION_INSIGHTS_VERSION}
      testId="transaction-insights"
    >
      <ButtonGroup>
        <Button
          variant="primary"
          id="getAccounts"
          className="mb-3"
          disabled={isLoading}
          onClick={handleGetAccounts}
        >
          Get Accounts
        </Button>
        <Button
          variant="primary"
          id="sendInsights"
          className="mb-3"
          disabled={isLoading || !accounts?.length}
          onClick={handleSendTransaction}
        >
          Send Transaction
        </Button>
      </ButtonGroup>
      <Result>
        <span id="insightsResult">
          {JSON.stringify(transaction, null, 2)}
          {JSON.stringify(error, null, 2)}
        </span>
      </Result>
    </Snap>
  );
};
