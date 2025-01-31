import type {
  RestrictedMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type {
  Caveat,
  GetPermissions,
  ValidPermission,
} from '@metamask/permission-controller';
import {
  getSignatureOriginCaveat,
  getTransactionOriginCaveat,
  SnapEndowments,
} from '@metamask/snaps-rpc-methods';
import type { Json, SnapId } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import { hasProperty, hexToBigInt } from '@metamask/utils';

import type { DeleteInterface } from '../interface';
import type { GetAllSnaps, HandleSnapRequest } from '../snaps';
import { getRunnableSnaps } from '../snaps';
import type {
  TransactionControllerUnapprovedTransactionAddedEvent,
  TransactionMeta,
  SignatureStateChange,
  SignatureControllerState,
  StateSignature,
  TransactionControllerTransactionStatusUpdatedEvent,
} from '../types';

const controllerName = 'SnapInsightsController';

export type SnapInsightsControllerAllowedActions =
  | HandleSnapRequest
  | GetAllSnaps
  | GetPermissions
  | DeleteInterface;

export type SnapInsightsControllerGetStateAction = ControllerGetStateAction<
  typeof controllerName,
  SnapInsightsControllerState
>;

export type SnapInsightsControllerActions =
  SnapInsightsControllerGetStateAction;

export type SnapInsightControllerStateChangeEvent = ControllerStateChangeEvent<
  typeof controllerName,
  SnapInsightsControllerState
>;

export type SnapInsightControllerEvents = SnapInsightControllerStateChangeEvent;

export type SnapInsightsControllerAllowedEvents =
  | TransactionControllerUnapprovedTransactionAddedEvent
  | TransactionControllerTransactionStatusUpdatedEvent
  | SignatureStateChange;

export type SnapInsightsControllerMessenger = RestrictedMessenger<
  typeof controllerName,
  SnapInsightsControllerActions | SnapInsightsControllerAllowedActions,
  SnapInsightControllerEvents | SnapInsightsControllerAllowedEvents,
  SnapInsightsControllerAllowedActions['type'],
  SnapInsightsControllerAllowedEvents['type']
>;

export type SnapInsight = {
  snapId: SnapId;
  interfaceId?: string | null;
  error?: string;
  loading: boolean;
  severity?: string;
};

export type SnapInsightsControllerState = {
  insights: Record<string, Record<SnapId, SnapInsight>>;
};

export type SnapInsightsControllerArgs = {
  messenger: SnapInsightsControllerMessenger;
  state?: SnapInsightsControllerState;
};

type SnapWithPermission = {
  snapId: SnapId;
  permission: ValidPermission<string, Caveat<string, Json>>;
};

/**
 * Controller for monitoring for new transactions and signatures to provide insight for.
 */
export class SnapInsightsController extends BaseController<
  typeof controllerName,
  SnapInsightsControllerState,
  SnapInsightsControllerMessenger
> {
  constructor({ messenger, state }: SnapInsightsControllerArgs) {
    super({
      messenger,
      metadata: {
        insights: { persist: false, anonymous: false },
      },
      name: controllerName,
      state: { insights: {}, ...state },
    });

    this.messagingSystem.subscribe(
      'TransactionController:unapprovedTransactionAdded',
      this.#handleTransaction.bind(this),
    );

    this.messagingSystem.subscribe(
      'TransactionController:transactionStatusUpdated',
      this.#handleTransactionStatusUpdate.bind(this),
    );

    this.messagingSystem.subscribe(
      'SignatureController:stateChange',
      this.#handleSignatureStateChange.bind(this),
    );
  }

  /**
   * Check if an insight already exists for a given ID.
   *
   * @param id - The ID.
   * @returns True if the insight already exists, otherwise false.
   */
  #hasInsight(id: string) {
    return hasProperty(this.state.insights, id);
  }

  /**
   * Get a list of runnable Snaps that have a given permission.
   * Also includes the permission object itself.
   *
   * @param permissionName - The permission name.
   * @returns A list of objects containing Snap IDs and the permission object.
   */
  #getSnapsWithPermission(permissionName: string) {
    const allSnaps = this.messagingSystem.call('SnapController:getAll');
    const filteredSnaps = getRunnableSnaps(allSnaps);

    return filteredSnaps.reduce<SnapWithPermission[]>((accumulator, snap) => {
      const permissions = this.messagingSystem.call(
        'PermissionController:getPermissions',
        snap.id,
      );
      if (permissions && hasProperty(permissions, permissionName)) {
        accumulator.push({
          snapId: snap.id,
          permission: permissions[permissionName],
        });
      }

      return accumulator;
    }, []);
  }

  /**
   * Handle a newly added unapproved transaction.
   * This function fetches insights from all available Snaps
   * and populates the insights state blob with the responses.
   *
   * @param transaction - The transaction object.
   */
  #handleTransaction(transaction: TransactionMeta) {
    const { id, txParams, chainId, origin } = transaction;

    // This assumes that the transactions are EVM-compatible for now.
    const caipChainId = `eip155:${hexToBigInt(chainId).toString(10)}`;

    const snaps = this.#getSnapsWithPermission(
      SnapEndowments.TransactionInsight,
    );

    snaps.forEach(({ snapId, permission }) => {
      const hasTransactionOriginCaveat = getTransactionOriginCaveat(permission);
      const transactionOrigin =
        hasTransactionOriginCaveat && origin ? origin : null;

      this.update((state) => {
        state.insights[id] ??= {};
        state.insights[id][snapId] = { snapId, loading: true };
      });

      this.#handleSnapRequest({
        snapId,
        handler: HandlerType.OnTransaction,
        params: {
          transaction: txParams,
          chainId: caipChainId,
          transactionOrigin,
        },
      })
        .then((response) =>
          this.#handleSnapResponse({
            id,
            snapId,
            response: response as Record<string, Json>,
          }),
        )
        .catch((error) => this.#handleSnapResponse({ id, snapId, error }));
    });
  }

  /**
   * Handle the stateChange event emitted by the SignatureController.
   * This function will remove existing insights from the state when applicable, as well as
   * trigger insight fetching for newly added signatures.
   *
   * @param state - The SignatureController state blob.
   */
  #handleSignatureStateChange(state: SignatureControllerState) {
    // If any IDs have disappeared since the last state update, the insight may be cleaned up.
    for (const id of Object.keys(this.state.insights)) {
      if (
        !hasProperty(state.unapprovedTypedMessages, id) &&
        !hasProperty(state.unapprovedPersonalMsgs, id)
      ) {
        this.#handleInsightCleanup(id);
      }
    }

    if (
      state.unapprovedPersonalMsgCount > 0 ||
      state.unapprovedTypedMessagesCount > 0
    ) {
      const snaps = this.#getSnapsWithPermission(
        SnapEndowments.SignatureInsight,
      );

      // This isn't very efficient, but SignatureController doesn't expose a better event for us to use yet.
      for (const personalSignature of Object.values(
        state.unapprovedPersonalMsgs,
      )) {
        this.#handleSignature(snaps, personalSignature);
      }

      for (const typedMessage of Object.values(state.unapprovedTypedMessages)) {
        this.#handleSignature(snaps, typedMessage);
      }
    }
  }

  /**
   * Handle a newly added unapproved signature.
   * This function fetches insights from all available Snaps
   * and populates the insights state blob with the responses.
   *
   * @param snaps - A list of Snaps to invoke.
   * @param signature - The signature object.
   */
  #handleSignature(snaps: SnapWithPermission[], signature: StateSignature) {
    const { id, msgParams } = signature;

    if (this.#hasInsight(id)) {
      return;
    }

    const { from, data, signatureMethod, origin } = msgParams;

    /**
     * Both eth_signTypedData_v3 and eth_signTypedData_v4 methods
     * need to be parsed because their data is stringified. All other
     * signature methods do not, so they are ignored.
     */
    const shouldParse =
      signatureMethod === 'eth_signTypedData_v3' ||
      signatureMethod === 'eth_signTypedData_v4';

    const payload = {
      from,
      data: shouldParse ? JSON.parse(data as string) : data,
      signatureMethod,
    };

    snaps.forEach(({ snapId, permission }) => {
      const hasSignatureOriginCaveat = getSignatureOriginCaveat(permission);
      const signatureOrigin =
        origin && hasSignatureOriginCaveat ? origin : null;

      this.update((state) => {
        state.insights[id] ??= {};
        state.insights[id][snapId] = { snapId, loading: true };
      });

      this.#handleSnapRequest({
        snapId,
        handler: HandlerType.OnSignature,
        params: { signature: payload, signatureOrigin },
      })
        .then((response) =>
          this.#handleSnapResponse({
            id,
            snapId,
            response: response as Record<string, Json>,
          }),
        )
        .catch((error) => this.#handleSnapResponse({ id, snapId, error }));
    });
  }

  /**
   * Handle the transactionStatusUpdated event emitted by the TransactionController.
   * This function will remove insights for the transaction in question
   * once the transaction status has changed from unapproved.
   *
   * @param args - An options bag.
   * @param args.transactionMeta - The transaction.
   */
  #handleTransactionStatusUpdate({
    transactionMeta,
  }: {
    transactionMeta: TransactionMeta;
  }) {
    if (transactionMeta.status !== 'unapproved') {
      this.#handleInsightCleanup(transactionMeta.id);
    }
  }

  #handleInsightCleanup(id: string) {
    if (!this.#hasInsight(id)) {
      return;
    }

    // Delete interfaces from interface controller.
    Object.values(this.state.insights[id])
      .filter((insight) => insight.interfaceId)
      .forEach((insight) => {
        this.messagingSystem.call(
          'SnapInterfaceController:deleteInterface',
          insight.interfaceId as string,
        );
      });

    this.update((state) => {
      delete state.insights[id];
    });
  }

  /**
   * Handle sending a request to a given Snap with a given payload.
   *
   * @param args - An options bag.
   * @param args.snapId - The Snap ID.
   * @param args.handler - The handler to invoke.
   * @param args.params - The JSON-RPC params to send.
   * @returns The response from the Snap.
   */
  async #handleSnapRequest({
    snapId,
    handler,
    params,
  }: {
    snapId: SnapId;
    handler: HandlerType.OnTransaction | HandlerType.OnSignature;
    params: Record<string, Json>;
  }) {
    return this.messagingSystem.call('SnapController:handleRequest', {
      snapId,
      origin: '',
      handler,
      request: {
        method: '',
        params,
      },
    });
  }

  /**
   * Handle response from a given Snap by persisting the response or error in state.
   *
   * @param args - An options bag.
   * @param args.id - The transaction or signature ID.
   * @param args.snapId - The Snap ID.
   * @param args.response - An optional response object returned by the Snap.
   * @param args.error - An optional error returned by the Snap.
   */
  #handleSnapResponse({
    id,
    snapId,
    response,
    error,
  }: {
    id: string;
    snapId: SnapId;
    response?: Record<string, Json>;
    error?: Error;
  }) {
    // If the insight has been cleaned up already, we can skip setting the state.
    // This may happen if a user accepts/rejects a transaction/signature faster than the Snap responds.
    if (!this.#hasInsight(id)) {
      return;
    }

    this.update((state) => {
      state.insights[id][snapId].loading = false;
      state.insights[id][snapId].interfaceId = response?.id as string;
      state.insights[id][snapId].severity = response?.severity as string;
      state.insights[id][snapId].error = error?.message;
    });
  }
}
