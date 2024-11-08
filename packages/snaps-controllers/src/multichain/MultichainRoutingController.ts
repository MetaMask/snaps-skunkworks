import type {
  RestrictedControllerMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type {
  Caveat,
  GetPermissions,
  ValidPermission,
} from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import {
  getProtocolCaveatChainIds,
  getProtocolCaveatRpcMethods,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type {
  EmptyObject,
  Json,
  JsonRpcRequest,
  SnapId,
} from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import type {
  CaipAccountAddress,
  CaipAccountId,
  CaipChainId,
} from '@metamask/utils';
import { hasProperty } from '@metamask/utils';

import { getRunnableSnaps } from '../snaps';
import type { GetAllSnaps, HandleSnapRequest } from '../snaps';

export type MultichainRoutingControllerGetStateAction =
  ControllerGetStateAction<
    typeof controllerName,
    MultichainRoutingControllerState
  >;
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
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | AccountsControllerListMultichainAccountsAction
  | MultichainRoutingControllerGetStateAction;

export type MultichainRoutingControllerEvents =
  MultichainRoutingControllerStateChangeEvent;

export type MultichainRoutingControllerMessenger =
  RestrictedControllerMessenger<
    typeof controllerName,
    MultichainRoutingControllerActions,
    MultichainRoutingControllerEvents,
    MultichainRoutingControllerActions['type'],
    MultichainRoutingControllerEvents['type']
  >;

export type MultichainRoutingControllerArgs = {
  messenger: MultichainRoutingControllerMessenger;
  state?: MultichainRoutingControllerState;
};

export type MultichainRoutingControllerState = EmptyObject;

type SnapWithPermission = {
  snapId: SnapId;
  permission: ValidPermission<string, Caveat<string, Json>>;
};

const controllerName = 'MultichainRoutingController';

export class MultichainRoutingController extends BaseController<
  typeof controllerName,
  MultichainRoutingControllerState,
  MultichainRoutingControllerMessenger
> {
  constructor({ messenger, state }: MultichainRoutingControllerArgs) {
    super({
      messenger,
      metadata: {},
      name: controllerName,
      state: {
        ...state,
      },
    });
  }

  async #resolveRequestAddress(
    snapId: SnapId,
    chainId: CaipChainId,
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
              chainId,
              request,
            },
          },
          handler: HandlerType.OnProtocolRequest, // TODO: Export and request format
        },
      )) as { address: string } | null;
      return result?.address;
    } catch {
      throw rpcErrors.internal();
    }
  }

  async #getAccountSnap(
    connectedAddresses: CaipAccountAddress[],
    chainId: CaipChainId,
    request: JsonRpcRequest,
  ) {
    const accounts = this.messagingSystem
      .call('AccountsController:listMultichainAccounts', chainId)
      .filter(
        (account) =>
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
      chainId,
      request,
    );

    // If we have a resolved address, try to find the selected account based on that
    // otherwise, default to one of the connected accounts.
    // TODO: Eventually let the user choose if we have more than one option for the account.
    const selectedAccount = accounts.find(
      (account) =>
        connectedAddresses.includes(account.address) &&
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

  #getProtocolSnaps(chainId: CaipChainId) {
    const allSnaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(allSnaps);

    return filteredSnaps.reduce<SnapWithPermission[]>((accumulator, snap) => {
      const permissions = this.messagingSystem.call(
        'PermissionController:getPermissions',
        snap.id,
      );
      if (permissions && hasProperty(permissions, SnapEndowments.Protocol)) {
        const permission = permissions[SnapEndowments.Protocol];
        const chains = getProtocolCaveatChainIds(permission);
        if (chains?.includes(chainId)) {
          accumulator.push({
            snapId: snap.id,
            permission,
          });
        }
      }

      return accumulator;
    }, []);
  }

  async handleRequest({
    connectedAddresses,
    chainId,
    request,
  }: {
    connectedAddresses: CaipAccountId[];
    origin: string;
    chainId: CaipChainId;
    request: JsonRpcRequest;
  }) {
    // TODO: Determine if the request is already validated here?
    const { method } = request;

    // If the RPC request can be serviced by an account Snap, route it there.
    const accountSnap = await this.#getAccountSnap(
      connectedAddresses,
      chainId,
      request,
    );
    if (accountSnap) {
      return this.messagingSystem.call('SnapController:handleRequest', {
        snapId: accountSnap.snapId,
        origin: 'metamask', // TODO: Determine origin of these requests?
        request,
        handler: HandlerType.OnKeyringRequest,
      });
    }

    // If the RPC request cannot be serviced by an account Snap,
    // but has a protocol Snap available, route it there.
    const protocolSnaps = this.#getProtocolSnaps(chainId);
    const protocolSnap = protocolSnaps.find((snap) =>
      getProtocolCaveatRpcMethods(snap.permission)?.includes(method),
    );
    if (protocolSnap) {
      return this.messagingSystem.call('SnapController:handleRequest', {
        snapId: protocolSnap.snapId,
        origin: 'metamask', // TODO: Determine origin of these requests?
        request: {
          method: '',
          params: {
            request,
            chainId,
          },
        },
        handler: HandlerType.OnProtocolRequest,
      });
    }

    // If no compatible account or protocol Snaps were found, throw.
    throw rpcErrors.methodNotFound();
  }
}
