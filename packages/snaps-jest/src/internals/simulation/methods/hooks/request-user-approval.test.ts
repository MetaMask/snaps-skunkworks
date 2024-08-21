import { DIALOG_APPROVAL_TYPES } from '@metamask/snaps-rpc-methods';
import { DialogType } from '@metamask/snaps-sdk';

import { getRequestUserApprovalImplementation } from './request-user-approval';
import { getMockOptions } from '../../../../test-utils';
import { createStore, resolveInterface } from '../../store';

describe('getShowUserApprovalImplementation', () => {
  it('returns the implementation of the `requestUserApproval` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getRequestUserApprovalImplementation(runSaga);

    const promise = fn({
      type: DIALOG_APPROVAL_TYPES[DialogType.Alert],
      requestData: { id: 'foo' },
    });
    store.dispatch(resolveInterface('result'));

    expect(await promise).toBe('result');
  });
});
