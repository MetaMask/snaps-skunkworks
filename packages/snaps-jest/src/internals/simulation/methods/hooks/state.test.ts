import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import {
  getClearSnapStateMethodImplementation,
  getGetSnapStateMethodImplementation,
  getUpdateSnapStateMethodImplementation,
} from './state';
import { getMockOptions } from '../../../../test-utils';
import { createStore, getState, setState } from '../../store';

describe('getGetSnapStateMethodImplementation', () => {
  it('returns the implementation of the `getSnapState` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getGetSnapStateMethodImplementation(runSaga);

    expect(await fn(MOCK_SNAP_ID)).toBeNull();

    store.dispatch(
      setState({
        state: JSON.stringify({
          foo: 'bar',
        }),
        encrypted: true,
      }),
    );

    expect(await fn(MOCK_SNAP_ID)).toStrictEqual({
      foo: 'bar',
    });
  });

  it('returns the implementation of the `getSnapState` hook for unencrypted state', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getGetSnapStateMethodImplementation(runSaga);

    expect(await fn(MOCK_SNAP_ID, false)).toBeNull();

    store.dispatch(
      setState({
        state: JSON.stringify({
          foo: 'bar',
        }),
        encrypted: false,
      }),
    );

    expect(await fn(MOCK_SNAP_ID, false)).toStrictEqual({
      foo: 'bar',
    });
  });
});

describe('getUpdateSnapStateMethodImplementation', () => {
  it('returns the implementation of the `updateSnapState` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getUpdateSnapStateMethodImplementation(runSaga);

    expect(getState(true)(store.getState())).toBeNull();

    fn(MOCK_SNAP_ID, { foo: 'bar' });

    expect(getState(true)(store.getState())).toStrictEqual(
      JSON.stringify({
        foo: 'bar',
      }),
    );
  });

  it('returns the implementation of the `updateSnapState` hook for unencrypted state', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getUpdateSnapStateMethodImplementation(runSaga);

    expect(getState(false)(store.getState())).toBeNull();

    fn(MOCK_SNAP_ID, { foo: 'bar' }, false);

    expect(getState(false)(store.getState())).toStrictEqual(
      JSON.stringify({
        foo: 'bar',
      }),
    );
  });
});

describe('getClearSnapStateMethodImplementation', () => {
  it('returns the implementation of the `clearSnapState` hook', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getClearSnapStateMethodImplementation(runSaga);

    store.dispatch(
      setState({
        state: JSON.stringify({
          foo: 'bar',
        }),
        encrypted: true,
      }),
    );

    await fn(MOCK_SNAP_ID);

    expect(getState(true)(store.getState())).toBeNull();
  });

  it('returns the implementation of the `clearSnapState` hook for unencrypted state', async () => {
    const { store, runSaga } = createStore(getMockOptions());
    const fn = getClearSnapStateMethodImplementation(runSaga);

    store.dispatch(
      setState({
        state: JSON.stringify({
          foo: 'bar',
        }),
        encrypted: false,
      }),
    );

    await fn(MOCK_SNAP_ID, false);

    expect(getState(false)(store.getState())).toBeNull();
  });
});
