import type {
  ActionConstraint,
  ActionHandler,
  EventConstraint,
} from '@metamask/base-controller';
import { Messenger } from '@metamask/base-controller';

export class MockControllerMessenger<
  Action extends ActionConstraint,
  Event extends EventConstraint,
> extends Messenger<Action, Event> {
  /**
   * Registers an action handler for the given action type. If an action handler
   * already exists for the given action type, it will be overwritten.
   *
   * @param actionType - The action type to register the handler for.
   * @param handler - The action handler to register.
   */
  registerActionHandler<ActionType extends Action['type']>(
    actionType: ActionType,
    handler: ActionHandler<Action, ActionType>,
  ) {
    super.unregisterActionHandler(actionType);
    super.registerActionHandler(actionType, handler);
  }
}
