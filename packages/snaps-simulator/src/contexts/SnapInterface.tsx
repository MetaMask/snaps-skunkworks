import { UserInputEventType } from '@metamask/snaps-sdk';
import type { FormState, State } from '@metamask/snaps-sdk';
import { HandlerType } from '@metamask/snaps-utils';
import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import type { FunctionComponent, ReactNode } from 'react';
import { createContext, useContext } from 'react';

import {
  getSnapInterfaceController,
  getSnapInterface,
  sendRequest,
  setSnapInterfaceState,
} from '../features';
import { useDispatch, useSelector } from '../hooks';
import { mergeValue } from './utils';

/**
 * A no-op function.
 * Used when there is no Snap Interface to interact with.
 */
const noOp = () => {
  /* No Op */
};

export type GetValue = (name: string, form?: string) => State | undefined;

export type HandleInputChange = (
  name: string,
  value: string | null,
  form?: string,
) => void;

export type HandleEvent = (args: {
  event: UserInputEventType;
  name?: string;
  value?: State;
}) => void;

export type SnapInterfaceContextType = {
  getValue: GetValue;
  handleInputChange: HandleInputChange;
  handleEvent: HandleEvent;
};

const initialState = {
  getValue: noOp as GetValue,
  handleInputChange: noOp as HandleInputChange,
  handleEvent: noOp as HandleEvent,
};

export const SnapInterfaceContext =
  createContext<SnapInterfaceContextType>(initialState);

export type SnapInterfaceContextProviderProps = {
  children: ReactNode;
};

// We want button clicks to be instant and therefore use throttling
// to protect the Snap
// Any event not in this array will be debounced instead of throttled
const THROTTLED_EVENTS = [
  UserInputEventType.ButtonClickEvent,
  UserInputEventType.FormSubmitEvent,
];

/**
 * A provider for the Snap Interface context.
 * This context provides functions to interact with the Snap Interface.
 *
 * @param props - The props of the component.
 * @param props.children - The children of the component.
 * @returns A provider for the Snap Interface context.
 */
export const SnapInterfaceContextProvider: FunctionComponent<
  SnapInterfaceContextProviderProps
> = ({ children }) => {
  const dispatch = useDispatch();
  const snapInterface = useSelector(getSnapInterface);
  const snapInterfaceController = useSelector(getSnapInterfaceController);

  if (!snapInterface) {
    return (
      <SnapInterfaceContext.Provider value={initialState}>
        {children}
      </SnapInterfaceContext.Provider>
    );
  }

  const { id, state } = snapInterface;

  /**
   * Send a request to the Snap.
   *
   * @param event - The event type.
   * @param name - The name of the component emitting the event.
   * @param value - The value of the component emitting the event.
   */
  const rawSnapRequestFunction = (
    event: UserInputEventType,
    name?: string,
    value?: State | FormState,
  ) => {
    dispatch(
      sendRequest({
        origin: '',
        handler: HandlerType.OnUserInput,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {
            event: {
              type: event,
              // TODO: Allow null in the types and simplify this
              ...(name !== undefined && name !== null ? { name } : {}),
              ...(value !== undefined && value !== null ? { value } : {}),
            },
            id,
          },
        },
      }),
    );
  };

  /**
   * Debounce the request to the Snap.
   */
  const snapRequestDebounced = debounce(rawSnapRequestFunction, 200);

  /**
   * Throttle the request to the Snap.
   */
  const snapRequestThrottled = throttle(rawSnapRequestFunction, 200);

  /**
   * Handle the submission of an user input event to the Snap.
   *
   * @param options - An options bag.
   * @param options.event - The event type.
   * @param options.name - The name of the component emitting the event.
   * @param options.value - The value of the component emitting the event.
   */
  const handleEvent: HandleEvent = ({
    event,
    name,
    value = name ? ((state as FormState)[name] ?? undefined) : undefined,
  }) => {
    const fn = THROTTLED_EVENTS.includes(event)
      ? snapRequestThrottled
      : snapRequestDebounced;
    fn(event, name, value);
  };

  const getValue: GetValue = (name, form) => {
    const value = form
      ? (state[form] as FormState)?.[name]
      : (state as FormState)?.[name];

    if (value) {
      return value;
    }

    return undefined;
  };

  /**
   * Handle the change of an input value.
   *
   * @param name - The name of the input.
   * @param value - The new value of the input.
   * @param form - The form containing the input.
   */
  const handleInputChange: HandleInputChange = (name, value, form) => {
    const newState = mergeValue(state, name, value, form);

    snapInterfaceController?.updateInterfaceState(id, newState);
    dispatch(setSnapInterfaceState(newState));

    handleEvent({
      event: UserInputEventType.InputChangeEvent,
      name,
      value: value ?? '',
    });
  };

  return (
    <SnapInterfaceContext.Provider
      value={{ getValue, handleInputChange, handleEvent }}
    >
      {children}
    </SnapInterfaceContext.Provider>
  );
};

/**
 * Get the Snap Interface context.
 *
 * @returns The Snap Interface context.
 */
export function useSnapInterfaceContext() {
  return useContext(SnapInterfaceContext);
}
