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
import { SnapEndowments } from '@metamask/snaps-rpc-methods';
import type {
  EmptyObject,
  Json,
  JsonRpcRequest,
  SnapId,
} from '@metamask/snaps-sdk';
import { HandlerType, type Caip2ChainId } from '@metamask/snaps-utils';
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
};

export type AccountsControllerListMultichainAccountsAction = {
  type: `AccountsController:listMultichainAccounts`;
  handler: (chainId?: Caip2ChainId) => InternalAccount[];
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

  #getAccountSnapMethods(chainId: Caip2ChainId) {
    const accounts = this.messagingSystem.call(
      'AccountsController:listMultichainAccounts',
      chainId,
    );

    return accounts.flatMap((account) => account.methods);
  }

  #getProtocolSnaps(_chainId: Caip2ChainId, _method: string) {
    const allSnaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(allSnaps);

    return filteredSnaps.reduce<SnapWithPermission[]>((accumulator, snap) => {
      const permissions = this.messagingSystem.call(
        'PermissionController:getPermissions',
        snap.id,
      );
      // TODO: Protocol Snap export
      // TODO: Filter based on chain ID and method
      if (permissions && hasProperty(permissions, SnapEndowments.Rpc)) {
        accumulator.push({
          snapId: snap.id,
          permission: permissions[SnapEndowments.Rpc],
        });
      }

      return accumulator;
    }, []);
  }

  async handleRequest({
    chainId,
    request,
  }: {
    origin: string;
    chainId: Caip2ChainId;
    request: JsonRpcRequest;
  }) {
    // TODO: Determine if the request is already validated here?
    const { method } = request;

    // If the RPC request can be serviced by an account Snap, route it there.
    const accountMethods = this.#getAccountSnapMethods(chainId);
    if (accountMethods.includes(method)) {
      // TODO: Determine how to call the AccountsRouter
      return null;
    }

    // If the RPC request cannot be serviced by an account Snap,
    // but has a protocol Snap available, route it there.
    const protocolSnaps = this.#getProtocolSnaps(chainId, method);
    const snapId = protocolSnaps[0]?.snapId;
    if (snapId) {
      return this.messagingSystem.call('SnapController:handleRequest', {
        snapId,
        origin: 'metamask', // TODO: Determine origin of these requests?
        request,
        handler: HandlerType.OnRpcRequest, // TODO: Protocol Snap export
      });
    }

    // If no compatible account or protocol Snaps were found, throw.
    throw rpcErrors.methodNotFound();
  }
}
