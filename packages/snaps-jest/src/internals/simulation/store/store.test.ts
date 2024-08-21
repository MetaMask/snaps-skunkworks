import { createStore } from './store';
import { getMockOptions } from '../../../test-utils';

describe('createStore', () => {
  it('creates a Redux store', () => {
    const { store } = createStore(getMockOptions());

    expect(store).toBeDefined();
    expect(store.getState()).toMatchInlineSnapshot(`
      {
        "mocks": {
          "jsonRpc": {},
        },
        "notifications": {
          "notifications": [],
        },
        "state": {
          "encrypted": null,
          "unencrypted": null,
        },
        "ui": {
          "current": null,
        },
      }
    `);
  });

  it('creates a Redux store with initial state', () => {
    const { store } = createStore(
      getMockOptions({
        state: {
          foo: 'bar',
        },
      }),
    );

    expect(store).toBeDefined();
    expect(store.getState()).toMatchInlineSnapshot(`
      {
        "mocks": {
          "jsonRpc": {},
        },
        "notifications": {
          "notifications": [],
        },
        "state": {
          "encrypted": "{"foo":"bar"}",
          "unencrypted": null,
        },
        "ui": {
          "current": null,
        },
      }
    `);
  });

  it('creates a Redux store with initial unencrypted state', () => {
    const { store } = createStore(
      getMockOptions({
        unencryptedState: {
          foo: 'bar',
        },
      }),
    );

    expect(store).toBeDefined();
    expect(store.getState()).toMatchInlineSnapshot(`
      {
        "mocks": {
          "jsonRpc": {},
        },
        "notifications": {
          "notifications": [],
        },
        "state": {
          "encrypted": null,
          "unencrypted": "{"foo":"bar"}",
        },
        "ui": {
          "current": null,
        },
      }
    `);
  });
});
