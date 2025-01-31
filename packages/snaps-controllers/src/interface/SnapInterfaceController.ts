import type {
  AcceptRequest,
  HasApprovalRequest,
} from '@metamask/approval-controller';
import type {
  RestrictedMessenger,
  ControllerGetStateAction,
  ControllerStateChangeEvent,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type {
  MaybeUpdateState,
  TestOrigin,
} from '@metamask/phishing-controller';
import type {
  InterfaceState,
  SnapId,
  ComponentOrElement,
  InterfaceContext,
} from '@metamask/snaps-sdk';
import { ContentType } from '@metamask/snaps-sdk';
import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import { getJsonSizeUnsafe, validateJsxLinks } from '@metamask/snaps-utils';
import type { Json } from '@metamask/utils';
import { assert, hasProperty } from '@metamask/utils';
import { castDraft } from 'immer';
import { nanoid } from 'nanoid';

import type { GetSnap } from '../snaps';
import {
  constructState,
  getJsxInterface,
  validateInterfaceContext,
} from './utils';

const MAX_UI_CONTENT_SIZE = 10_000_000; // 10 mb

const controllerName = 'SnapInterfaceController';

export type CreateInterface = {
  type: `${typeof controllerName}:createInterface`;
  handler: SnapInterfaceController['createInterface'];
};

export type GetInterface = {
  type: `${typeof controllerName}:getInterface`;
  handler: SnapInterfaceController['getInterface'];
};

export type UpdateInterface = {
  type: `${typeof controllerName}:updateInterface`;
  handler: SnapInterfaceController['updateInterface'];
};

export type DeleteInterface = {
  type: `${typeof controllerName}:deleteInterface`;
  handler: SnapInterfaceController['deleteInterface'];
};

export type UpdateInterfaceState = {
  type: `${typeof controllerName}:updateInterfaceState`;
  handler: SnapInterfaceController['updateInterfaceState'];
};

export type ResolveInterface = {
  type: `${typeof controllerName}:resolveInterface`;
  handler: SnapInterfaceController['resolveInterface'];
};

export type SnapInterfaceControllerGetStateAction = ControllerGetStateAction<
  typeof controllerName,
  SnapInterfaceControllerState
>;

export type SnapInterfaceControllerAllowedActions =
  | TestOrigin
  | MaybeUpdateState
  | HasApprovalRequest
  | AcceptRequest
  | GetSnap;

export type SnapInterfaceControllerActions =
  | CreateInterface
  | GetInterface
  | UpdateInterface
  | DeleteInterface
  | UpdateInterfaceState
  | ResolveInterface
  | SnapInterfaceControllerGetStateAction;

export type SnapInterfaceControllerStateChangeEvent =
  ControllerStateChangeEvent<
    typeof controllerName,
    SnapInterfaceControllerState
  >;

type OtherNotification = { type: string; [key: string]: unknown };

export type ExpandedView = {
  title: string;
  interfaceId: string;
  footerLink?: { href: string; text: string };
};

type NormalSnapNotificationData = { message: string; origin: string };

type ExpandedSnapNotificationData = {
  message: string;
  origin: string;
  detailedView: ExpandedView;
};

type SnapNotification = {
  type: 'snap';
  data: NormalSnapNotificationData | ExpandedSnapNotificationData;
  readDate: string | null;
};

type Notification = OtherNotification | SnapNotification;

type NotificationListUpdatedEvent = {
  type: 'NotificationServicesController:notificationsListUpdated';
  payload: [Notification[]];
};

export type SnapInterfaceControllerEvents =
  | SnapInterfaceControllerStateChangeEvent
  | NotificationListUpdatedEvent;

export type SnapInterfaceControllerMessenger = RestrictedMessenger<
  typeof controllerName,
  SnapInterfaceControllerActions | SnapInterfaceControllerAllowedActions,
  SnapInterfaceControllerEvents,
  SnapInterfaceControllerAllowedActions['type'],
  SnapInterfaceControllerEvents['type']
>;

export type StoredInterface = {
  snapId: SnapId;
  content: JSXElement;
  state: InterfaceState;
  context: InterfaceContext | null;
  contentType: ContentType | null;
};

export type SnapInterfaceControllerState = {
  interfaces: Record<string, StoredInterface>;
};

export type SnapInterfaceControllerArgs = {
  messenger: SnapInterfaceControllerMessenger;
  state?: SnapInterfaceControllerState;
};

/**
 * Use this controller to manage snaps UI interfaces using RPC method hooks.
 */
export class SnapInterfaceController extends BaseController<
  typeof controllerName,
  SnapInterfaceControllerState,
  SnapInterfaceControllerMessenger
> {
  constructor({ messenger, state }: SnapInterfaceControllerArgs) {
    super({
      messenger,
      metadata: {
        interfaces: {
          persist: (interfaces: Record<string, StoredInterface>) => {
            return Object.entries(interfaces).reduce<
              Record<string, StoredInterface>
            >((persistedInterfaces, [id, snapInterface]) => {
              switch (snapInterface.contentType) {
                case ContentType.Notification:
                  persistedInterfaces[id] = snapInterface;
                  return persistedInterfaces;
                default:
                  return persistedInterfaces;
              }
            }, {});
          },
          anonymous: false,
        },
      },
      name: controllerName,
      state: { interfaces: {}, ...state },
    });

    this.messagingSystem.subscribe(
      'NotificationServicesController:notificationsListUpdated',
      this.#onNotificationsListUpdated.bind(this),
    );

    this.#registerMessageHandlers();
  }

  /**
   * Constructor helper for registering this controller's messaging system
   * actions.
   */
  #registerMessageHandlers() {
    this.messagingSystem.registerActionHandler(
      `${controllerName}:createInterface`,
      this.createInterface.bind(this),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:getInterface`,
      this.getInterface.bind(this),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:updateInterface`,
      this.updateInterface.bind(this),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:deleteInterface`,
      this.deleteInterface.bind(this),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:updateInterfaceState`,
      this.updateInterfaceState.bind(this),
    );

    this.messagingSystem.registerActionHandler(
      `${controllerName}:resolveInterface`,
      this.resolveInterface.bind(this),
    );
  }

  /**
   * Create an interface in the controller state with the associated data.
   *
   * @param snapId - The snap id that created the interface.
   * @param content - The interface content.
   * @param context - An optional interface context object.
   * @param contentType - The type of content.
   * @returns The newly interface id.
   */
  async createInterface(
    snapId: SnapId,
    content: ComponentOrElement,
    context?: InterfaceContext,
    contentType?: ContentType,
  ) {
    const element = getJsxInterface(content);
    await this.#validateContent(element);
    validateInterfaceContext(context);

    const id = nanoid();
    const componentState = constructState({}, element);

    this.update((draftState) => {
      // @ts-expect-error - TS2589: Type instantiation is excessively deep and
      // possibly infinite.
      draftState.interfaces[id] = {
        snapId,
        content: castDraft(element),
        state: componentState,
        context: context ?? null,
        contentType: contentType ?? null,
      };
    });

    return id;
  }

  /**
   * Get the data of a given interface id.
   *
   * @param snapId - The snap id requesting the interface data.
   * @param id - The interface id.
   * @returns The interface state.
   */
  getInterface(snapId: SnapId, id: string) {
    this.#validateArgs(snapId, id);

    return this.state.interfaces[id];
  }

  /**
   * Update the interface with the given content.
   *
   * @param snapId - The snap id requesting the update.
   * @param id - The interface id.
   * @param content - The new content.
   * @param context - An optional interface context object.
   */
  async updateInterface(
    snapId: SnapId,
    id: string,
    content: ComponentOrElement,
    context?: InterfaceContext,
  ) {
    this.#validateArgs(snapId, id);
    const element = getJsxInterface(content);
    await this.#validateContent(element);
    validateInterfaceContext(context);

    const oldState = this.state.interfaces[id].state;
    const newState = constructState(oldState, element);

    this.update((draftState) => {
      draftState.interfaces[id].state = newState;
      draftState.interfaces[id].content = castDraft(element);
      if (context) {
        draftState.interfaces[id].context = context;
      }
    });
  }

  /**
   * Delete an interface from state.
   *
   * @param id - The interface id.
   */
  deleteInterface(id: string) {
    this.update((draftState) => {
      delete draftState.interfaces[id];
    });
  }

  /**
   * Update the interface state.
   *
   * @param id - The interface id.
   * @param state - The new state.
   */
  updateInterfaceState(id: string, state: InterfaceState) {
    this.update((draftState) => {
      draftState.interfaces[id].state = state;
    });
  }

  /**
   * Resolve the promise of a given interface approval request.
   * The approval needs to have the same ID as the interface.
   *
   * @param snapId - The snap id.
   * @param id - The interface id.
   * @param value - The value to resolve the promise with.
   */
  async resolveInterface(snapId: SnapId, id: string, value: Json) {
    this.#validateArgs(snapId, id);
    this.#validateApproval(id);

    await this.#acceptApprovalRequest(id, value);

    this.deleteInterface(id);
  }

  /**
   * Utility function to validate the args passed to the other methods.
   *
   * @param snapId - The snap id.
   * @param id - The interface id.
   */
  #validateArgs(snapId: SnapId, id: string) {
    const existingInterface = this.state.interfaces[id];

    assert(
      existingInterface !== undefined,
      `Interface with id '${id}' not found.`,
    );
    assert(
      existingInterface.snapId === snapId,
      `Interface not created by ${snapId}.`,
    );
  }

  /**
   * Utility function to validate that the approval request exists.
   *
   * @param id - The interface id.
   */
  #validateApproval(id: string) {
    assert(
      this.#hasApprovalRequest(id),
      `Approval request with id '${id}' not found.`,
    );
  }

  /**
   * Trigger a Phishing list update if needed.
   */
  async #triggerPhishingListUpdate() {
    await this.messagingSystem.call('PhishingController:maybeUpdateState');
  }

  /**
   * Check an origin against the phishing list.
   *
   * @param origin - The origin to check.
   * @returns True if the origin is on the phishing list, otherwise false.
   */
  #checkPhishingList(origin: string) {
    return this.messagingSystem.call('PhishingController:testOrigin', origin)
      .result;
  }

  /**
   * Check if an approval request exists for a given interface by looking up
   * if the ApprovalController has a request with the given interface ID.
   *
   * @param id - The interface id.
   * @returns True if an approval request exists, otherwise false.
   */
  #hasApprovalRequest(id: string) {
    return this.messagingSystem.call('ApprovalController:hasRequest', {
      id,
    });
  }

  /**
   * Accept an approval request for a given interface.
   *
   * @param id - The interface id.
   * @param value - The value to resolve the promise with.
   */
  async #acceptApprovalRequest(id: string, value: Json) {
    await this.messagingSystem.call(
      'ApprovalController:acceptRequest',
      id,
      value,
    );
  }

  /**
   * Utility function to validate the components of an interface.
   * Throws if something is invalid.
   *
   * @param element - The JSX element to verify.
   */
  async #validateContent(element: JSXElement) {
    // We assume the validity of this JSON to be validated by the caller.
    // E.g., in the RPC method implementation.
    const size = getJsonSizeUnsafe(element);
    assert(
      size <= MAX_UI_CONTENT_SIZE,
      `A Snap UI may not be larger than ${MAX_UI_CONTENT_SIZE / 1000000} MB.`,
    );

    await this.#triggerPhishingListUpdate();
    validateJsxLinks(
      element,
      this.#checkPhishingList.bind(this),
      (id: string) => this.messagingSystem.call('SnapController:get', id),
    );
  }

  #onNotificationsListUpdated(notificationsList: Notification[]) {
    const snapNotificationsWithInterface = notificationsList.filter(
      (notification) => {
        return (
          notification.type === 'snap' &&
          hasProperty((notification as SnapNotification).data, 'detailedView')
        );
      },
    );

    const interfaceIdSet = new Set(
      snapNotificationsWithInterface.map(
        (notification) =>
          (
            (notification as SnapNotification)
              .data as ExpandedSnapNotificationData
          ).detailedView.interfaceId,
      ),
    );

    this.update((state) => {
      Object.entries(state.interfaces).forEach(([id, snapInterface]) => {
        if (
          snapInterface.contentType === ContentType.Notification &&
          !interfaceIdSet.has(id)
        ) {
          delete state.interfaces[id];
        }
      });
    });
  }
}
