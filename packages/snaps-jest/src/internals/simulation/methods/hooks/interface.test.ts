import { SnapInterfaceController } from '@metamask/snaps-controllers';
import { text } from '@metamask/snaps-sdk';
import { getJsxElementFromComponent } from '@metamask/snaps-utils';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import {
  getCreateInterfaceImplementation,
  getGetInterfaceImplementation,
} from './interface';
import {
  getRestrictedSnapInterfaceControllerMessenger,
  getRootControllerMessenger,
} from '../../../../test-utils';

describe('getCreateInterfaceImplementation', () => {
  it('returns the implementation of the `createInterface` hook', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const interfaceController = new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const fn = getCreateInterfaceImplementation(controllerMessenger);

    const content = text('bar');

    const id = await fn(MOCK_SNAP_ID, content);

    const result = interfaceController.getInterface(MOCK_SNAP_ID, id);

    expect(controllerMessenger.call).toHaveBeenCalledWith(
      'SnapInterfaceController:createInterface',
      MOCK_SNAP_ID,
      content,
      undefined,
    );

    expect(result.content).toStrictEqual(getJsxElementFromComponent(content));
  });
});

describe('getGetInterfaceImplementation', () => {
  it('returns the implementation of the `getInterface` hook', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const interfaceController = new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    jest.spyOn(controllerMessenger, 'call');

    const fn = getGetInterfaceImplementation(controllerMessenger);

    const content = text('bar');

    const id = await interfaceController.createInterface(MOCK_SNAP_ID, content);

    const result = fn(MOCK_SNAP_ID, id);

    expect(controllerMessenger.call).toHaveBeenCalledWith(
      'SnapInterfaceController:getInterface',
      MOCK_SNAP_ID,
      id,
    );
    expect(result).toStrictEqual({
      content: getJsxElementFromComponent(content),
      state: {},
      snapId: MOCK_SNAP_ID,
      context: null,
    });
  });
});
