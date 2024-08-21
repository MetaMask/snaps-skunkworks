/* eslint-disable no-invalid-this */

// Note: Because this file imports from `@jest/globals`, it can only be used in
// a Jest environment. This is why it's not exported from the index file.

import type { MatcherFunction } from '@jest/expect';
import { expect } from '@jest/globals';
import type {
  NotificationType,
  EnumToUnion,
  ComponentOrElement,
  Component,
} from '@metamask/snaps-sdk';
import type { JSXElement } from '@metamask/snaps-sdk/jsx';
import { isJSXElementUnsafe } from '@metamask/snaps-sdk/jsx';
import {
  getJsxElementFromComponent,
  serialiseJsx,
} from '@metamask/snaps-utils';
import { is } from '@metamask/superstruct';
import type { Json } from '@metamask/utils';
import { hasProperty } from '@metamask/utils';
import type { MatcherHintOptions } from 'jest-matcher-utils';
import {
  EXPECTED_COLOR,
  diff,
  matcherErrorMessage,
  matcherHint,
  printReceived,
  printWithType,
  RECEIVED_COLOR,
} from 'jest-matcher-utils';

import { InterfaceStruct, SnapResponseStruct } from './internals';
import type { SnapResponse } from './types';

/**
 * Ensure that the actual value is a response from the `request` function.
 *
 * @param actual - The actual value.
 * @param matcherName - The name of the matcher.
 * @param options - The matcher options.
 */
function assertActualIsSnapResponse(
  actual: unknown,
  matcherName: string,
  options?: MatcherHintOptions,
): asserts actual is SnapResponse {
  if (!is(actual, SnapResponseStruct)) {
    throw new Error(
      matcherErrorMessage(
        matcherHint(matcherName, undefined, undefined, options),
        `${RECEIVED_COLOR(
          'received',
        )} value must be a response from the \`request\` function`,
        printWithType('Received', actual, printReceived),
      ),
    );
  }
}

/**
 * Ensure that the actual value is a response from the `request` function, and
 * that it has a `ui` property.
 *
 * @param actual - The actual value.
 * @param matcherName - The name of the matcher.
 * @param options - The matcher options.
 */
function assertHasInterface(
  actual: unknown,
  matcherName: string,
  options?: MatcherHintOptions,
): asserts actual is { content: JSXElement } {
  if (!is(actual, InterfaceStruct) || !actual.content) {
    throw new Error(
      matcherErrorMessage(
        matcherHint(matcherName, undefined, undefined, options),
        `${RECEIVED_COLOR('received')} value must have a \`content\` property`,
        printWithType('Received', actual, printReceived),
      ),
    );
  }
}

/**
 * Check if a JSON-RPC response matches the expected value. This matcher is
 * intended to be used with the `expect` global.
 *
 * @param actual - The actual response.
 * @param expected - The expected response.
 * @returns The status and message.
 */
export const toRespondWith: MatcherFunction<[expected: Json]> = function (
  actual,
  expected,
) {
  assertActualIsSnapResponse(actual, 'toRespondWith');

  const { response } = actual;
  if (hasProperty(response, 'error')) {
    const message = () =>
      `${this.utils.matcherHint('.toRespondWith')}\n\n` +
      `Expected response: ${this.utils.printExpected(expected)}\n` +
      `Received error: ${this.utils.printReceived(response.error)}`;

    return { message, pass: false };
  }

  const pass = this.equals(response.result, expected);
  const message = pass
    ? () =>
        `${this.utils.matcherHint('.not.toRespondWith')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(response.result)}`
    : () =>
        `${this.utils.matcherHint('.toRespondWith')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(response.result)}`;

  return { message, pass };
};

export const toRespondWithError: MatcherFunction<[expected: Json]> = function (
  actual,
  expected,
) {
  assertActualIsSnapResponse(actual, 'toRespondWithError');

  const { response } = actual;
  if (hasProperty(response, 'result')) {
    const message = () =>
      `${this.utils.matcherHint('.toRespondWithError')}\n\n` +
      `Expected error: ${this.utils.printExpected(expected)}\n` +
      `Received result: ${this.utils.printReceived(response.result)}`;

    return { message, pass: false };
  }

  const pass = this.equals(response.error, expected);
  const message = pass
    ? () =>
        `${this.utils.matcherHint('.not.toRespondWithError')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(response.error)}`
    : () =>
        `${this.utils.matcherHint('.toRespondWithError')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Received: ${this.utils.printReceived(response.error)}`;

  return { message, pass };
};

/**
 * Check if the snap sent a notification with the expected message. This matcher
 * is intended to be used with the `expect` global.
 *
 * @param actual - The actual response.
 * @param expected - The expected notification message.
 * @param type - The expected notification type.
 * @returns The status and message.
 */
export const toSendNotification: MatcherFunction<
  [expected: string, type?: EnumToUnion<NotificationType> | undefined]
> = function (actual, expected, type) {
  assertActualIsSnapResponse(actual, 'toSendNotification');

  const { notifications } = actual;
  const pass = notifications.some(
    (notification) =>
      this.equals(notification.message, expected) &&
      (type === undefined || notification.type === type),
  );

  const message = pass
    ? () =>
        `${this.utils.matcherHint('.not.toSendNotification')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Expected type: ${this.utils.printExpected(type)}\n` +
        `Received: ${this.utils.printReceived(notifications)}`
    : () =>
        `${this.utils.matcherHint('.toSendNotification')}\n\n` +
        `Expected: ${this.utils.printExpected(expected)}\n` +
        `Expected type: ${this.utils.printExpected(type)}\n` +
        `Received: ${this.utils.printReceived(notifications)}`;

  return { message, pass };
};

const toRenderLegacy: MatcherFunction<[expected: Component]> = function (
  actual,
  expected,
) {
  assertHasInterface(actual, 'toRender');

  const { content } = actual;
  const expectedElement = getJsxElementFromComponent(expected);
  const pass = this.equals(content, expectedElement);

  // This is typed as `string | null`, but in practice it's always a string.
  // The function only returns `null` if both the expected and actual values
  // are numbers, bigints, or booleans, which is never the case here.
  const difference = diff(expectedElement, content) as string;

  const message = pass
    ? () =>
        `${this.utils.matcherHint('.not.toRender')}\n\n` +
        `Expected:\n${this.utils.printExpected(expectedElement)}\n\n` +
        `Received:\n${this.utils.printReceived(content)}` +
        `\n\nDifference:\n\n${difference}`
    : () =>
        `${this.utils.matcherHint('.toRender')}\n\n` +
        `Expected:\n${this.utils.printExpected(expectedElement)}\n\n` +
        `Received:\n${this.utils.printReceived(content)}` +
        `\n\nDifference:\n\n${difference}`;

  return { message, pass };
};

export const toRender: MatcherFunction<[expected: ComponentOrElement]> =
  async function (actual, expected) {
    assertHasInterface(actual, 'toRender');

    if (!isJSXElementUnsafe(expected)) {
      return toRenderLegacy.call(this, actual, expected);
    }

    const { content } = actual;
    const pass = this.equals(content, expected);

    // This is typed as `string | null`, but in practice it's always a string.
    // The function only returns `null` if both the expected and actual values
    // are numbers, bigints, or booleans, which is never the case here.
    const difference = diff(
      serialiseJsx(expected),
      serialiseJsx(content),
    ) as string;

    const message = pass
      ? () =>
          `${this.utils.matcherHint('.not.toRender')}\n\n` +
          `Expected:\n${EXPECTED_COLOR(serialiseJsx(expected))}\n\n` +
          `Received:\n${RECEIVED_COLOR(serialiseJsx(content))}` +
          `\n\nDifference:\n\n${difference}`
      : () =>
          `${this.utils.matcherHint('.toRender')}\n\n` +
          `Expected:\n${EXPECTED_COLOR(serialiseJsx(expected))}\n\n` +
          `Received:\n${RECEIVED_COLOR(serialiseJsx(content))}` +
          `\n\nDifference:\n\n${difference}`;

    return { message, pass };
  };

expect.extend({
  toRespondWith,
  toRespondWithError,
  toSendNotification,
  toRender,
});
