import type { RestrictedMessenger } from '@metamask/base-controller';
import type { GetPermissions } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import {
  getProtocolCaveatScopes,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { Json, JsonRpcRequest, SnapId } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import type {
  CaipAccountId,
  CaipChainId,
  JsonRpcParams,
} from '@metamask/utils';
import {
  assert,
  hasProperty,
  KnownCaipNamespace,
  parseCaipAccountId,
} from '@metamask/utils';

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

export type MultichainRouterGetSupportedAccountsAction = {
  type: `${typeof name}:getSupportedAccounts`;
  handler: MultichainRouter['getSupportedAccounts'];
};

export type MultichainRouterIsSupportedScopeAction = {
  type: `${typeof name}:isSupportedScope`;
  handler: MultichainRouter['isSupportedScope'];
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
  submitRequest: (request: {
    account: string;
    method: string;
    params?: Json[] | Record<string, Json>;
    scope: CaipChainId;
  }) => Promise<Json>;
  resolveAccountAddress: (
    snapId: SnapId,
    scope: CaipChainId,
    request: Json,
  ) => Promise<{ address: CaipAccountId } | null>;
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
  | MultichainRouterGetSupportedMethodsAction
  | MultichainRouterGetSupportedAccountsAction
  | MultichainRouterIsSupportedScopeAction;

export type MultichainRouterAllowedActions =
  | GetAllSnaps
  | HandleSnapRequest
  | GetPermissions
  | AccountsControllerListMultichainAccountsAction;

export type MultichainRouterEvents = never;

export type MultichainRouterMessenger = RestrictedMessenger<
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

    this.#messenger.registerActionHandler(
      `${name}:getSupportedAccounts`,
      (...args) => this.getSupportedAccounts(...args),
    );

    this.#messenger.registerActionHandler(
      `${name}:isSupportedScope`,
      (...args) => this.isSupportedScope(...args),
    );
  }

  /**
   * Attempts to resolve the account address to use for a given request by inspecting the request itself.
   *
   * The request is sent to to an account Snap via the SnapKeyring that will attempt this resolution.
   *
   * @param snapId - The ID of the Snap to send the request to.
   * @param scope - The CAIP-2 scope for the request.
   * @param request - The JSON-RPC request.
   * @returns The resolved address if found, otherwise null.
   * @throws If the invocation of the SnapKeyring fails.
   */
  async #resolveRequestAddress(
    snapId: SnapId,
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    try {
      const result = await this.#withSnapKeyring(async (keyring) =>
        keyring.resolveAccountAddress(snapId, scope, request),
      );
      const address = result?.address;
      return address ? parseCaipAccountId(address).address : null;
    } catch {
      throw rpcErrors.internal();
    }
  }

  /**
   * Get the account ID of the account that should service the RPC request via an account Snap.
   *
   * This function checks whether any accounts exist that can service a given request by
   * using a combination of the resolveAccountAddress functionality and the connected accounts.
   *
   * If an account is expected to service this request but none is found, the function will throw.
   *
   * @param connectedAddresses - The CAIP-10 addresses connected to the requesting origin.
   * @param scope - The CAIP-2 scope for the request.
   * @param request - The JSON-RPC request.
   * @returns An account ID if found, otherwise null.
   * @throws If no account is found, but the accounts exist that could service the request.
   */
  async #getSnapAccountId(
    connectedAddresses: CaipAccountId[],
    scope: CaipChainId,
    request: JsonRpcRequest,
  ) {
    const accounts = this.#messenger
      .call('AccountsController:listMultichainAccounts', scope)
      .filter(
        (
          account: InternalAccount,
        ): account is InternalAccount & {
          metadata: Required<InternalAccount['metadata']>;
        } =>
          Boolean(account.metadata.snap?.enabled) &&
          account.methods.includes(request.method),
      );

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
      throw rpcErrors.invalidParams({
        message: 'No available account found for request.',
      });
    }

    return selectedAccount.id;
  }

  /**
   * Get all protocol Snaps that can service a given CAIP-2 scope.
   *
   * Protocol Snaps are deemed fit to service a scope if they are runnable
   * and have the proper permissions set for the scope.
   *
   * @param scope - A CAIP-2 scope.
   * @returns A list of all the protocol Snaps available and their RPC methods.
   */
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
  }): Promise<Json> {
    // Explicitly block EVM scopes, just in case.
    assert(
      !scope.startsWith(KnownCaipNamespace.Eip155) &&
        !scope.startsWith('wallet:eip155'),
    );

    const { method, params } = request;

    // If the RPC request can be serviced by an account Snap, route it there.
    const accountId = await this.#getSnapAccountId(
      connectedAddresses,
      scope,
      request,
    );

    if (accountId) {
      return this.#withSnapKeyring(async (keyring) =>
        keyring.submitRequest({
          account: accountId,
          scope,
          method,
          params: params as JsonRpcParams,
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
      }) as Promise<Json>;
    }

    // If no compatible account or protocol Snaps were found, throw.
    throw rpcErrors.methodNotFound();
  }

  /**
   * Get a list of metadata for supported accounts for a given scope from the client.
   *
   * @param scope - The CAIP-2 scope.
   * @returns A list of metadata for the supported accounts.
   */
  #getSupportedAccountsMetadata(scope: CaipChainId): InternalAccount[] {
    return this.#messenger
      .call('AccountsController:listMultichainAccounts', scope)
      .filter((account: InternalAccount) => account.metadata.snap?.enabled);
  }

  /**
   * Get a list of supported methods for a given scope.
   * This combines both protocol and account Snaps supported methods.
   *
   * @param scope - The CAIP-2 scope.
   * @returns A list of supported methods.
   */
  getSupportedMethods(scope: CaipChainId): string[] {
    const accountMethods = this.#getSupportedAccountsMetadata(scope).flatMap(
      (account) => account.methods,
    );

    const protocolMethods = this.#getProtocolSnaps(scope).flatMap(
      (snap) => snap.methods,
    );

    return Array.from(new Set([...accountMethods, ...protocolMethods]));
  }

  /**
   * Get a list of supported accounts for a given scope.
   *
   * @param scope - The CAIP-2 scope.
   * @returns A list of CAIP-10 addresses.
   */
  getSupportedAccounts(scope: CaipChainId): string[] {
    return this.#getSupportedAccountsMetadata(scope).map(
      (account) => `${scope}:${account.address}`,
    );
  }

  /**
   * Determine whether a given CAIP-2 scope is supported by the router.
   *
   * @param scope - The CAIP-2 scope.
   * @returns True if the router can service the scope, otherwise false.
   */
  isSupportedScope(scope: CaipChainId): boolean {
    // We currently assume here that if one Snap exists that service the scope, we can service the scope generally.
    return this.#messenger
      .call('AccountsController:listMultichainAccounts', scope)
      .some((account: InternalAccount) => account.metadata.snap?.enabled);
  }
}
