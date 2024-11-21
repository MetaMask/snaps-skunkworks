import type { RestrictedControllerMessenger } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import {
  getProtocolCaveatScopes,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { Json, JsonRpcRequest, SnapId } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import type { CaipAccountId, CaipChainId } from '@metamask/utils';
import { hasProperty, parseCaipAccountId } from '@metamask/utils';

import { getRunnableSnaps } from '../snaps';
import type { GetAllSnaps, HandleSnapRequest } from '../snaps';

export type MultichainRouterHandleRequestAction = {
  type: `${typeof name}:handleRequest`;
  handler: MultichainRouter['handleRequest'];
};

// Since the AccountsController depends on snaps-controllers we manually type this
type InternalAccount = {
  id: string;
  type: string;
  address: string;
  options: Record<string, Json>;
  methods: string[];
  metadata: {
    name: string;
    snap?: { id: SnapId; enabled: boolean; name: string };
  };
};

export type AccountsControllerListMultichainAccountsAction = {
  type: `AccountsController:listMultichainAccounts`;
  handler: (chainId?: CaipChainId) => InternalAccount[];
};

export type KeyringControllerSubmitNonEvmRequestAction = {
  type: `KeyringController:submitNonEvmRequest`;
  handler: (args: {
    address: string;
    method: string;
    params?: Json[] | Record<string, Json>;
    chainId: CaipChainId;
  }) => Promise<Json>;
};

export type MultichainRouterActions = MultichainRouterHandleRequestAction;

export type MultichainRouterAllowedActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | AccountsControllerListMultichainAccountsAction
  | KeyringControllerSubmitNonEvmRequestAction;

export type MultichainRouterEvents = never;

export type MultichainRouterMessenger = RestrictedControllerMessenger<
  typeof name,
  MultichainRouterActions | MultichainRouterAllowedActions,
  never,
  MultichainRouterAllowedActions['type'],
  MultichainRouterEvents['type']
>;

export type MultichainRouterArgs = {
  messenger: MultichainRouterMessenger;
};

type ProtocolSnap = {
  snapId: SnapId;
  methods: string[];
};

const name = 'MultichainRouter';

export class MultichainRouter {
  #messenger: MultichainRouterMessenger;

  constructor({ messenger }: MultichainRouterArgs) {
    this.#messenger = messenger;

    this.#messenger.registerActionHandler(
      `${name}:handleRequest`,
      async (...args) => this.handleRequest(...args),
    );
  }

  async #resolveRequestAddress(
    snapId: SnapId,
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    try {
      // TODO: Decide if we should call this using another abstraction.
      const result = (await this.#messenger.call(
        'SnapController:handleRequest',
        {
          snapId,
          origin: 'metamask',
          request: {
            method: 'keyring_resolveAccountAddress',
            params: {
              scope,
              request,
            },
          },
          handler: HandlerType.OnKeyringRequest,
        },
      )) as { address: CaipAccountId } | null;
      const address = result?.address;
      return address ? parseCaipAccountId(address).address : null;
    } catch {
      throw rpcErrors.internal();
    }
  }

  async #getAccountSnap(
    connectedAddresses: CaipAccountId[],
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    const accounts = this.#messenger
      .call('AccountsController:listMultichainAccounts', scope)
      .filter(
        (account: InternalAccount) =>
          account.metadata.snap?.enabled &&
          account.methods.includes(request.method),
      ) as (InternalAccount & {
      metadata: Required<InternalAccount['metadata']>;
    })[];

    // If no accounts can service the request, return null.
    if (accounts.length === 0) {
      return null;
    }

    const resolutionSnapId = accounts[0].metadata.snap.id;

    // Attempt to resolve the address that should be used for signing.
    const address = await this.#resolveRequestAddress(
      resolutionSnapId,
      scope,
      request,
    );

    const parsedConnectedAddresses = connectedAddresses.map(
      (connectedAddress) => parseCaipAccountId(connectedAddress).address,
    );

    // If we have a resolved address, try to find the selected account based on that
    // otherwise, default to one of the connected accounts.
    // TODO: Eventually let the user choose if we have more than one option for the account.
    const selectedAccount = accounts.find(
      (account) =>
        parsedConnectedAddresses.includes(account.address) &&
        (!address || account.address.toLowerCase() === address.toLowerCase()),
    );

    if (!selectedAccount) {
      throw rpcErrors.invalidParams();
    }

    return {
      address: selectedAccount.address,
      snapId: selectedAccount.metadata.snap.id,
    };
  }

  #getProtocolSnaps(scope: CaipChainId) {
    const allSnaps = this.#messenger.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(allSnaps);

    return filteredSnaps.reduce<ProtocolSnap[]>((accumulator, snap) => {
      const permissions = this.#messenger.call(
        'PermissionController:getPermissions',
        snap.id,
      );
      if (permissions && hasProperty(permissions, SnapEndowments.Protocol)) {
        const permission = permissions[SnapEndowments.Protocol];
        const scopes = getProtocolCaveatScopes(permission);
        if (scopes && hasProperty(scopes, scope)) {
          accumulator.push({
            snapId: snap.id,
            methods: scopes[scope].methods,
          });
        }
      }

      return accumulator;
    }, []);
  }

  async handleRequest({
    connectedAddresses,
    origin,
    scope,
    request,
  }: {
    connectedAddresses: CaipAccountId[];
    origin: string;
    scope: CaipChainId;
    request: JsonRpcRequest;
  }): Promise<unknown> {
    // TODO: Determine if the request is already validated here?
    const { method, params } = request;

    // If the RPC request can be serviced by an account Snap, route it there.
    const accountSnap = await this.#getAccountSnap(
      connectedAddresses,
      scope,
      request,
    );
    if (accountSnap) {
      // TODO: Decide on API for this.
      return this.#messenger.call('KeyringController:submitNonEvmRequest', {
        address: accountSnap.address,
        method,
        params,
        chainId: scope,
      });
    }

    // If the RPC request cannot be serviced by an account Snap,
    // but has a protocol Snap available, route it there.
    const protocolSnaps = this.#getProtocolSnaps(scope);
    const protocolSnap = protocolSnaps.find((snap) =>
      snap.methods.includes(method),
    );
    if (protocolSnap) {
      return this.#messenger.call('SnapController:handleRequest', {
        snapId: protocolSnap.snapId,
        origin,
        request: {
          method: '',
          params: {
            request,
            scope,
          },
        },
        handler: HandlerType.OnProtocolRequest,
      });
    }

    // If no compatible account or protocol Snaps were found, throw.
    throw rpcErrors.methodNotFound();
  }
}
