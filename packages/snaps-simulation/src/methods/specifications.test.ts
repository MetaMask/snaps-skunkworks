import { Messenger } from '@metamask/base-controller';
import {
  getSnapManifest,
  MOCK_SNAP_ID,
} from '@metamask/snaps-utils/test-utils';

import { getControllers, registerSnap } from '../controllers';
import type { RestrictedMiddlewareHooks } from '../simulation';
import { getMockOptions } from '../test-utils/options';
import {
  asyncResolve,
  getEndowments,
  getPermissionSpecifications,
  resolve,
} from './specifications';

const MOCK_HOOKS: RestrictedMiddlewareHooks = {
  getMnemonic: jest.fn(),
  getSnapFile: jest.fn(),
  createInterface: jest.fn(),
  updateInterface: jest.fn(),
  getInterfaceState: jest.fn(),
  getIsLocked: jest.fn(),
  resolveInterface: jest.fn(),
};

describe('resolve', () => {
  it('returns a function which resolves with the specified result', async () => {
    const result = {};
    expect(await resolve(result)()).toBe(result);
  });
});

describe('asyncResolve', () => {
  it('returns a function which resolves with the specified result', async () => {
    const result = {};
    expect(await asyncResolve(result)()).toBe(result);
  });
});

describe('getPermissionSpecifications', () => {
  it('returns the permission specifications', async () => {
    expect(
      getPermissionSpecifications({
        hooks: MOCK_HOOKS,
        runSaga: jest.fn(),
        options: getMockOptions(),
        controllerMessenger: new Messenger(),
      }),
    ).toMatchInlineSnapshot(`
      {
        "endowment:assets": {
          "allowedCaveats": [
            "chainIds",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:assets",
          "validator": [Function],
        },
        "endowment:cronjob": {
          "allowedCaveats": [
            "snapCronjob",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:cronjob",
          "validator": [Function],
        },
        "endowment:ethereum-provider": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:ethereum-provider",
        },
        "endowment:keyring": {
          "allowedCaveats": [
            "keyringOrigin",
            "maxRequestTime",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:keyring",
          "validator": [Function],
        },
        "endowment:lifecycle-hooks": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:lifecycle-hooks",
        },
        "endowment:name-lookup": {
          "allowedCaveats": [
            "chainIds",
            "lookupMatchers",
            "maxRequestTime",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:name-lookup",
          "validator": [Function],
        },
        "endowment:network-access": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:network-access",
        },
        "endowment:page-home": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:page-home",
        },
        "endowment:page-settings": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:page-settings",
        },
        "endowment:protocol": {
          "allowedCaveats": [
            "protocolSnapScopes",
            "maxRequestTime",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:protocol",
          "validator": [Function],
        },
        "endowment:rpc": {
          "allowedCaveats": [
            "rpcOrigin",
            "maxRequestTime",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:rpc",
          "validator": [Function],
        },
        "endowment:signature-insight": {
          "allowedCaveats": [
            "signatureOrigin",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:signature-insight",
          "validator": [Function],
        },
        "endowment:transaction-insight": {
          "allowedCaveats": [
            "transactionOrigin",
            "maxRequestTime",
          ],
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:transaction-insight",
          "validator": [Function],
        },
        "endowment:webassembly": {
          "allowedCaveats": null,
          "endowmentGetter": [Function],
          "permissionType": "Endowment",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "endowment:webassembly",
        },
        "snap_dialog": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_dialog",
        },
        "snap_getBip32Entropy": {
          "allowedCaveats": [
            "permittedDerivationPaths",
          ],
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getBip32Entropy",
          "validator": [Function],
        },
        "snap_getBip32PublicKey": {
          "allowedCaveats": [
            "permittedDerivationPaths",
          ],
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getBip32PublicKey",
          "validator": [Function],
        },
        "snap_getBip44Entropy": {
          "allowedCaveats": [
            "permittedCoinTypes",
          ],
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getBip44Entropy",
          "validator": [Function],
        },
        "snap_getEntropy": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getEntropy",
        },
        "snap_getLocale": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getLocale",
        },
        "snap_getPreferences": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_getPreferences",
        },
        "snap_manageAccounts": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_manageAccounts",
        },
        "snap_manageState": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_manageState",
        },
        "snap_notify": {
          "allowedCaveats": null,
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "subjectTypes": [
            "snap",
          ],
          "targetName": "snap_notify",
        },
        "wallet_snap": {
          "allowedCaveats": [
            "snapIds",
          ],
          "methodImplementation": [Function],
          "permissionType": "RestrictedMethod",
          "sideEffect": {
            "onPermitted": [Function],
          },
          "targetName": "wallet_snap",
          "validator": [Function],
        },
      }
    `);
  });
});

describe('getEndowments', () => {
  it('returns the endowments', async () => {
    const controllers = getControllers({
      controllerMessenger: new Messenger(),
      hooks: MOCK_HOOKS,
      runSaga: jest.fn(),
      options: getMockOptions(),
    });

    await registerSnap(
      MOCK_SNAP_ID,
      getSnapManifest({
        initialPermissions: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'endowment:network-access': {},
        },
      }),
      controllers,
    );

    const endowments = await getEndowments(
      controllers.permissionController,
      MOCK_SNAP_ID,
    );
    expect(endowments).toMatchInlineSnapshot(`
      [
        "atob",
        "btoa",
        "BigInt",
        "console",
        "crypto",
        "Date",
        "Math",
        "setTimeout",
        "clearTimeout",
        "SubtleCrypto",
        "TextDecoder",
        "TextEncoder",
        "URL",
        "URLSearchParams",
        "setInterval",
        "clearInterval",
        "Int8Array",
        "Uint8Array",
        "Uint8ClampedArray",
        "Int16Array",
        "Uint16Array",
        "Int32Array",
        "isSecureContext",
        "Intl",
        "Uint32Array",
        "Float32Array",
        "Float64Array",
        "BigInt64Array",
        "BigUint64Array",
        "DataView",
        "ArrayBuffer",
        "AbortController",
        "AbortSignal",
        "fetch",
        "Request",
        "Headers",
        "Response",
      ]
    `);
  });
});
