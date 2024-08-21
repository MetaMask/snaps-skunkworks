import { SnapInterfaceController } from '@metamask/snaps-controllers';
import type { SnapId } from '@metamask/snaps-sdk';
import { UserInputEventType, button, input, text } from '@metamask/snaps-sdk';
import { Dropdown, Option, Radio, RadioGroup } from '@metamask/snaps-sdk/jsx';
import { getJsxElementFromComponent, HandlerType } from '@metamask/snaps-utils';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import {
  getInterfaceApi,
  getInterfaceFromResult,
  handleRequest,
} from './request';
import { handleInstallSnap } from './simulation';
import {
  getMockServer,
  getRestrictedSnapInterfaceControllerMessenger,
  getRootControllerMessenger,
} from '../test-utils';
import type { SnapResponseWithInterface } from '../types';

describe('handleRequest', () => {
  it('sends a JSON-RPC request and returns the response', async () => {
    const { snapId, close: closeServer } = await getMockServer({
      sourceCode: `
        module.exports.onRpcRequest = async (request) => {
          return 'Hello, world!';
        };
      `,
    });

    const snap = await handleInstallSnap(snapId);
    const response = await handleRequest({
      ...snap,
      handler: HandlerType.OnRpcRequest,
      request: {
        method: 'foo',
        params: ['bar'],
      },
    });

    expect(response).toStrictEqual({
      id: expect.any(String),
      response: {
        result: 'Hello, world!',
      },
      notifications: [],
    });

    await closeServer();
    await snap.executionService.terminateAllSnaps();
  });

  it('can get an interface from the SnapInterfaceController if the result contains an id', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const interfaceController = new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = text('foo');
    const id = await interfaceController.createInterface(
      'local:http://localhost:4242' as SnapId,
      content,
    );

    const { snapId, close: closeServer } = await getMockServer({
      sourceCode: `
        module.exports.onHomePage = async (request) => {
          return ({ id: '${id}' });
        };
      `,
      port: 4242,
    });

    const snap = await handleInstallSnap(snapId);
    const response = await handleRequest({
      ...snap,
      controllerMessenger,
      handler: HandlerType.OnHomePage,
      request: {
        method: '',
      },
    });

    expect(response).toStrictEqual({
      id: expect.any(String),
      response: {
        result: {
          id,
        },
      },
      notifications: [],
      getInterface: expect.any(Function),
    });

    await closeServer();
    await snap.executionService.terminateAllSnaps();
  });

  it('gracefully handles returned invalid UI', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const { snapId, close: closeServer } = await getMockServer({
      sourceCode: `
        module.exports.onHomePage = async (request) => {
          return ({ content: 'foo' });
        };
      `,
      port: 4242,
    });

    const snap = await handleInstallSnap(snapId);
    const response = await handleRequest({
      ...snap,
      controllerMessenger,
      handler: HandlerType.OnHomePage,
      request: {
        method: '',
      },
    });

    expect(response).toStrictEqual({
      id: expect.any(String),
      response: {
        error: expect.objectContaining({
          code: -32603,
          message: 'The Snap returned an invalid interface.',
        }),
      },
      notifications: [],
      getInterface: expect.any(Function),
    });

    expect(() =>
      (response as SnapResponseWithInterface).getInterface(),
    ).toThrow(
      'Unable to get the interface from the Snap: The request to the Snap failed.',
    );

    await closeServer();
    await snap.executionService.terminateAllSnaps();
  });

  it('gracefully handles returned invalid UI when not awaiting the request', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const { snapId, close: closeServer } = await getMockServer({
      sourceCode: `
        module.exports.onHomePage = async (request) => {
          return ({ content: 'foo' });
        };
      `,
      port: 4242,
    });

    const snap = await handleInstallSnap(snapId);
    const promise = handleRequest({
      ...snap,
      controllerMessenger,
      handler: HandlerType.OnHomePage,
      request: {
        method: '',
      },
    });

    await expect(promise.getInterface()).rejects.toThrow(
      'Unable to get the interface from the Snap: The returned interface may be invalid. The error message received was: The Snap returned an invalid interface.',
    );

    await closeServer();
    await snap.executionService.terminateAllSnaps();
  });

  it('returns an error response', async () => {
    const { snapId, close: closeServer } = await getMockServer({
      sourceCode: `
        module.exports.onRpcRequest = async (request) => {
          throw new Error('Something went wrong.');
        };
      `,
    });

    const snap = await handleInstallSnap(snapId);
    const response = await handleRequest({
      ...snap,
      handler: HandlerType.OnRpcRequest,
      request: {
        method: 'foo',
        params: ['bar'],
      },
    });

    expect(response).toStrictEqual({
      id: expect.any(String),
      response: {
        error: expect.objectContaining({
          code: -32603,
          message: 'Something went wrong.',
        }),
      },
      notifications: [],
      getInterface: expect.any(Function),
    });

    await closeServer();
    await snap.executionService.terminateAllSnaps();
  });
});

describe('getInterfaceFromResult', () => {
  const controllerMessenger = getRootControllerMessenger();
  // eslint-disable-next-line no-new
  new SnapInterfaceController({
    messenger:
      getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
  });

  it('returns the interface ID if the result includes it', async () => {
    const result = await getInterfaceFromResult(
      { id: 'foo' },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    expect(result).toBe('foo');
  });

  it('creates a new interface and returns its ID if the result contains content', async () => {
    jest.spyOn(controllerMessenger, 'call');

    const result = await getInterfaceFromResult(
      { content: text('foo') },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    expect(result).toStrictEqual(expect.any(String));

    expect(controllerMessenger.call).toHaveBeenCalledWith(
      'SnapInterfaceController:createInterface',
      MOCK_SNAP_ID,
      text('foo'),
    );
  });
});

describe('getInterfaceApi', () => {
  it('gets the content from the SnapInterfaceController if the result contains an interface ID', async () => {
    const controllerMessenger = getRootControllerMessenger();
    const interfaceController = new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });
    const content = text('foo');

    const id = await interfaceController.createInterface(MOCK_SNAP_ID, content);

    const getInterface = await getInterfaceApi(
      { id },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    expect(getInterface).toStrictEqual(expect.any(Function));

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = getInterface!();

    expect(result).toStrictEqual({
      content: getJsxElementFromComponent(content),
      clickElement: expect.any(Function),
      typeInField: expect.any(Function),
      selectInDropdown: expect.any(Function),
      selectFromRadioGroup: expect.any(Function),
      uploadFile: expect.any(Function),
    });
  });

  it('gets the content from the SnapInterfaceController if the result contains content', async () => {
    const controllerMessenger = getRootControllerMessenger();

    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = text('foo');

    const getInterface = await getInterfaceApi(
      { content },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    expect(getInterface).toStrictEqual(expect.any(Function));

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = getInterface!();

    expect(result).toStrictEqual({
      content: getJsxElementFromComponent(content),
      clickElement: expect.any(Function),
      typeInField: expect.any(Function),
      selectInDropdown: expect.any(Function),
      selectFromRadioGroup: expect.any(Function),
      uploadFile: expect.any(Function),
    });
  });

  it('returns undefined if there is no interface ID associated with the result', async () => {
    const controllerMessenger = getRootControllerMessenger();

    const result = await getInterfaceApi({}, MOCK_SNAP_ID, controllerMessenger);

    expect(result).toBeUndefined();
  });

  it('sends the request to the snap when using `clickElement`', async () => {
    const controllerMessenger = getRootControllerMessenger();

    jest.spyOn(controllerMessenger, 'call');

    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = button({ value: 'foo', name: 'foo' });

    const getInterface = await getInterfaceApi(
      { content },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snapInterface = getInterface!();

    await snapInterface.clickElement('foo');

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      5,
      'ExecutionService:handleRpcRequest',
      MOCK_SNAP_ID,
      {
        origin: '',
        handler: HandlerType.OnUserInput,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {
            event: {
              type: UserInputEventType.ButtonClickEvent,
              name: 'foo',
            },
            id: expect.any(String),
            context: null,
          },
        },
      },
    );
  });

  it('sends the request to the snap when using `typeInField`', async () => {
    const controllerMessenger = getRootControllerMessenger();

    jest.spyOn(controllerMessenger, 'call');

    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = input('foo');

    const getInterface = await getInterfaceApi(
      { content },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snapInterface = getInterface!();

    await snapInterface.typeInField('foo', 'bar');

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      6,
      'ExecutionService:handleRpcRequest',
      MOCK_SNAP_ID,
      {
        origin: '',
        handler: HandlerType.OnUserInput,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {
            event: {
              type: UserInputEventType.InputChangeEvent,
              name: 'foo',
              value: 'bar',
            },
            id: expect.any(String),
            context: null,
          },
        },
      },
    );
  });

  it('sends the request to the snap when using `selectInDropdown`', async () => {
    const controllerMessenger = getRootControllerMessenger();

    jest.spyOn(controllerMessenger, 'call');

    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = (
      <Dropdown name="foo">
        <Option value="option1">Option 1</Option>
        <Option value="option2">Option 2</Option>
      </Dropdown>
    );

    const getInterface = await getInterfaceApi(
      { content },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snapInterface = getInterface!();

    await snapInterface.selectInDropdown('foo', 'option2');

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      6,
      'ExecutionService:handleRpcRequest',
      MOCK_SNAP_ID,
      {
        origin: '',
        handler: HandlerType.OnUserInput,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {
            event: {
              type: UserInputEventType.InputChangeEvent,
              name: 'foo',
              value: 'option2',
            },
            id: expect.any(String),
            context: null,
          },
        },
      },
    );
  });

  it('sends the request to the snap when using `selectFromRadioGroup`', async () => {
    const controllerMessenger = getRootControllerMessenger();

    jest.spyOn(controllerMessenger, 'call');

    // eslint-disable-next-line no-new
    new SnapInterfaceController({
      messenger:
        getRestrictedSnapInterfaceControllerMessenger(controllerMessenger),
    });

    const content = (
      <RadioGroup name="foo">
        <Radio value="option1">Option 1</Radio>
        <Radio value="option2">Option 2</Radio>
      </RadioGroup>
    );

    const getInterface = await getInterfaceApi(
      { content },
      MOCK_SNAP_ID,
      controllerMessenger,
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const snapInterface = getInterface!();

    await snapInterface.selectFromRadioGroup('foo', 'option2');

    expect(controllerMessenger.call).toHaveBeenNthCalledWith(
      6,
      'ExecutionService:handleRpcRequest',
      MOCK_SNAP_ID,
      {
        origin: '',
        handler: HandlerType.OnUserInput,
        request: {
          jsonrpc: '2.0',
          method: ' ',
          params: {
            event: {
              type: UserInputEventType.InputChangeEvent,
              name: 'foo',
              value: 'option2',
            },
            id: expect.any(String),
            context: null,
          },
        },
      },
    );
  });
});
