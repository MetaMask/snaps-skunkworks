import type {
  RestrictedControllerMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import {
  getProtocolCaveatScopes,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type {
  EmptyObject,
  Json,
  JsonRpcRequest,
  SnapId,
} from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import type { CaipAccountId, CaipChainId } from '@metamask/utils';
import { hasProperty, parseCaipAccountId } from '@metamask/utils';

import { getRunnableSnaps } from '../snaps';
import type { GetAllSnaps, HandleSnapRequest } from '../snaps';

export type MultichainRoutingControllerGetStateAction =
  ControllerGetStateAction<
    typeof controllerName,
    MultichainRoutingControllerState
  >;

export type MultichainRoutingControllerHandleRequestAction = {
  type: `${typeof controllerName}:handleRequest`;
  handler: MultichainRoutingController['handleRequest'];
};

export type MultichainRoutingControllerStateChangeEvent =
  ControllerStateChangeEvent<
    typeof controllerName,
    MultichainRoutingControllerState
  >;

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

export type MultichainRoutingControllerActions =
  | MultichainRoutingControllerGetStateAction
  | MultichainRoutingControllerHandleRequestAction;

export type MultichainRoutingControllerAllowedActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | AccountsControllerListMultichainAccountsAction;

export type MultichainRoutingControllerEvents =
  MultichainRoutingControllerStateChangeEvent;

export type MultichainRoutingControllerMessenger =
  RestrictedControllerMessenger<
    typeof controllerName,
    | MultichainRoutingControllerActions
    | MultichainRoutingControllerAllowedActions,
    never,
    MultichainRoutingControllerAllowedActions['type'],
    MultichainRoutingControllerEvents['type']
  >;

export type SnapKeyring = {
  submitNonEvmRequest: (args: {
    address: string;
    method: string;
    params?: Json[] | Record<string, Json>;
    chainId: CaipChainId;
  }) => Promise<Json>;
};

export type MultichainRoutingControllerArgs = {
  messenger: MultichainRoutingControllerMessenger;
  state?: MultichainRoutingControllerState;
  getSnapKeyring: () => Promise<SnapKeyring>;
};

export type MultichainRoutingControllerState = EmptyObject;

type ProtocolSnap = {
  snapId: SnapId;
  methods: string[];
};

const controllerName = 'MultichainRoutingController';

export class MultichainRoutingController extends BaseController<
  typeof controllerName,
  MultichainRoutingControllerState,
  MultichainRoutingControllerMessenger
> {
  #getSnapKeyring: () => Promise<SnapKeyring>;

  constructor({
    messenger,
    state,
    getSnapKeyring,
  }: MultichainRoutingControllerArgs) {
    super({
      messenger,
      metadata: {},
      name: controllerName,
      state: {
        ...state,
      },
    });

    this.#getSnapKeyring = getSnapKeyring;

    this.messagingSystem.registerActionHandler(
      `${controllerName}:handleRequest`,
      async (...args) => this.handleRequest(...args),
    );
  }

  async #resolveRequestAddress(
    snapId: SnapId,
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    try {
      const result = (await this.messagingSystem.call(
        'SnapController:handleRequest',
        {
          snapId,
          origin: 'metamask',
          request: {
            method: '',
            params: {
              scope,
              request,
            },
          },
          handler: HandlerType.OnProtocolRequest, // TODO: Export and request format
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
    const accounts = this.messagingSystem
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
    const allSnaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(allSnaps);

    return filteredSnaps.reduce<ProtocolSnap[]>((accumulator, snap) => {
      const permissions = this.messagingSystem.call(
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
      const keyring = await this.#getSnapKeyring();
      return keyring.submitNonEvmRequest({
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
      return this.messagingSystem.call('SnapController:handleRequest', {
        snapId: protocolSnap.snapId,
        origin: 'metamask', // TODO: Determine origin of these requests?
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
