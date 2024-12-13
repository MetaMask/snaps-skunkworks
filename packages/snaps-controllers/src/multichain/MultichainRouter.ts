import type { RestrictedControllerMessenger } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import {
  getProtocolCaveatScopes,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { Json, JsonRpcRequest, SnapId } from '@metamask/snaps-sdk';
import type { Caip2ChainId } from '@metamask/snaps-utils';
import { HandlerType } from '@metamask/snaps-utils';
import type {
  CaipAccountId,
  CaipChainId,
  JsonRpcParams,
} from '@metamask/utils';
import { hasProperty, parseCaipAccountId } from '@metamask/utils';

import { getRunnableSnaps } from '../snaps';
import type { GetAllSnaps, HandleSnapRequest } from '../snaps';

export type MultichainRouterHandleRequestAction = {
  type: `${typeof name}:handleRequest`;
  handler: MultichainRouter['handleRequest'];
};

export type MultichainRouterGetSupportedMethodsAction = {
  type: `${typeof name}:getSupportedMethods`;
  handler: MultichainRouter['getSupportedMethods'];
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

type SnapKeyring = {
  submitRequest: (request: Record<string, Json>) => Promise<Json>;
  resolveAccountAddress: (options: {
    snapId: SnapId;
    scope: Caip2ChainId;
    request: Json;
  }) => Promise<{ address: CaipAccountId } | null>;
};

// Expecting a bound function that calls KeyringController.withKeyring selecting the Snap keyring
type WithSnapKeyringFunction = <ReturnType>(
  operation: (keyring: SnapKeyring) => Promise<ReturnType>,
) => Promise<ReturnType>;

export type AccountsControllerListMultichainAccountsAction = {
  type: `AccountsController:listMultichainAccounts`;
  handler: (chainId?: CaipChainId) => InternalAccount[];
};

export type MultichainRouterActions =
  | MultichainRouterHandleRequestAction
  | MultichainRouterGetSupportedMethodsAction;

export type MultichainRouterAllowedActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | AccountsControllerListMultichainAccountsAction;

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
  withSnapKeyring: WithSnapKeyringFunction;
};

type ProtocolSnap = {
  snapId: SnapId;
  methods: string[];
};

const name = 'MultichainRouter';

export class MultichainRouter {
  #messenger: MultichainRouterMessenger;

  #withSnapKeyring: WithSnapKeyringFunction;

  constructor({ messenger, withSnapKeyring }: MultichainRouterArgs) {
    this.#messenger = messenger;
    this.#withSnapKeyring = withSnapKeyring;

    this.#messenger.registerActionHandler(
      `${name}:handleRequest`,
      async (...args) => this.handleRequest(...args),
    );

    this.#messenger.registerActionHandler(
      `${name}:getSupportedMethods`,
      (...args) => this.getSupportedMethods(...args),
    );
  }

  async #resolveRequestAddress(
    snapId: SnapId,
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    try {
      // TODO: Decide if we should call this using another abstraction.
      const result = (await this.#withSnapKeyring(async (keyring) =>
        keyring.resolveAccountAddress({
          snapId,
          request,
          scope,
        }),
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
      accountId: selectedAccount.id,
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

  /**
   * Handle an incoming JSON-RPC request tied to a specific scope by routing
   * to either a procotol Snap or an account Snap.
   *
   * @param options - An options bag.
   * @param options.connectedAddresses - Addresses currently connected to the origin.
   * @param options.origin - The origin of the RPC request.
   * @param options.request - The JSON-RPC request.
   * @param options.scope - The CAIP-2 scope for the request.
   * @returns The response from the chosen Snap.
   * @throws If no handler was found.
   */
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
      return this.#withSnapKeyring(async (keyring) =>
        keyring.submitRequest({
          id: accountSnap.accountId,
          scope,
          request: {
            method,
            params: params as JsonRpcParams,
          },
        }),
      );
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

  /**
   * Get a list of supported methods for a given scope.
   * This combines both protocol and account Snaps supported methods.
   *
   * @param options - An options bag.
   * @param options.scope - The CAIP-2 scope.
   * @returns A list of supported methods.
   */
  getSupportedMethods({ scope }: { scope: CaipChainId }): string[] {
    const accountMethods = this.#messenger
      .call('AccountsController:listMultichainAccounts', scope)
      .filter((account: InternalAccount) => account.metadata.snap?.enabled)
      .flatMap((account) => account.methods);

    const protocolMethods = this.#getProtocolSnaps(scope).flatMap(
      (snap) => snap.methods,
    );

    return Array.from(new Set([...accountMethods, ...protocolMethods]));
  }
}
