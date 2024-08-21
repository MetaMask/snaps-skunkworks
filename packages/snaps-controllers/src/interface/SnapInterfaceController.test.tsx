import type { SnapId } from '@metamask/snaps-sdk';
import { form, image, input, panel, text } from '@metamask/snaps-sdk';
import {
  Box,
  Field,
  FileInput,
  Form,
  Image,
  Input,
  Link,
  Text,
} from '@metamask/snaps-sdk/jsx';
import { getJsxElementFromComponent } from '@metamask/snaps-utils';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import { SnapInterfaceController } from './SnapInterfaceController';
import {
  MockApprovalController,
  getRestrictedSnapInterfaceControllerMessenger,
  getRootSnapInterfaceControllerMessenger,
} from '../test-utils';

describe('SnapInterfaceController', () => {
  describe('createInterface', () => {
    it('can create a new interface', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = panel([
        text('[foo](https://foo.bar)'),
        form({
          name: 'foo',
          children: [input({ name: 'bar' })],
        }),
      ]);

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      const { content, state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        2,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        3,
        'PhishingController:testOrigin',
        'foo.bar',
      );

      expect(content).toStrictEqual(getJsxElementFromComponent(components));
      expect(state).toStrictEqual({ foo: { bar: null } });
    });

    it('can create a new interface from JSX', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Box>
          <Text>
            <Link href="https://foo.bar">foo</Link>
          </Text>
          <Form name="foo">
            <Field label="Bar">
              <Input name="bar" type="text" />
            </Field>
          </Form>
        </Box>
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        element,
      );

      const { content, state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        2,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        3,
        'PhishingController:testOrigin',
        'foo.bar',
      );

      expect(content).toStrictEqual(element);
      expect(state).toStrictEqual({ foo: { bar: null } });
    });

    it('supports providing interface context', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Box>
          <Text>
            <Link href="https://foo.bar">foo</Link>
          </Text>
        </Box>
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        element,
        { foo: 'bar' },
      );

      const { content, context } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(content).toStrictEqual(element);
      expect(context).toStrictEqual({ foo: 'bar' });
    });

    it('throws if interface context is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Box>
          <Text>
            <Link href="https://foo.bar">foo</Link>
          </Text>
        </Box>
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          element,
          { foo: 'a'.repeat(1_000_000) },
        ),
      ).rejects.toThrow('A Snap interface context may not be larger than 1 MB');
    });

    it('throws if a link is on the phishing list', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      rootMessenger.registerActionHandler(
        'PhishingController:maybeUpdateState',
        jest.fn(),
      );

      rootMessenger.registerActionHandler(
        'PhishingController:testOrigin',
        () => ({ result: true, type: 'all' }),
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = panel([
        text('[foo](https://foo.bar)'),
        form({
          name: 'foo',
          children: [input({ name: 'bar' })],
        }),
      ]);

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          components,
        ),
      ).rejects.toThrow('Invalid URL: The specified URL is not allowed.');

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        2,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        3,
        'PhishingController:testOrigin',
        'foo.bar',
      );
    });

    it('throws if a JSX link is on the phishing list', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      rootMessenger.registerActionHandler(
        'PhishingController:maybeUpdateState',
        jest.fn(),
      );

      rootMessenger.registerActionHandler(
        'PhishingController:testOrigin',
        () => ({ result: true, type: 'all' }),
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Box>
          <Text>
            Foo <Link href="https://foo.bar">Bar</Link>
          </Text>
        </Box>
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          element,
        ),
      ).rejects.toThrow('Invalid URL: The specified URL is not allowed.');

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        2,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        3,
        'PhishingController:testOrigin',
        'foo.bar',
      );
    });

    it('throws if UI content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const images = new Array(800_000).fill(image(`<svg />`));
      const components = panel(images);

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          components,
        ),
      ).rejects.toThrow('A Snap UI may not be larger than 10 MB.');
    });

    it('throws if JSX UI content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Box>{new Array(800_000).fill(<Image src="<svg />" />)}</Box>
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          element,
        ),
      ).rejects.toThrow('A Snap UI may not be larger than 10 MB.');
    });

    it('throws if text content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = panel([text('[foo](https://foo.bar)'.repeat(2500))]);

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:createInterface',
          MOCK_SNAP_ID,
          components,
        ),
      ).rejects.toThrow('The text in a Snap UI may not be larger than 50 kB.');
    });
  });

  describe('getInterface', () => {
    it('gets the interface', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      const { content } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(content).toStrictEqual(getJsxElementFromComponent(components));
    });

    it('throws if the snap requesting the interface is not the one that created it', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      expect(() =>
        rootMessenger.call(
          'SnapInterfaceController:getInterface',
          'foo' as SnapId,
          id,
        ),
      ).toThrow(`Interface not created by foo.`);
    });

    it('throws if the interface does not exist', () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      expect(() =>
        rootMessenger.call(
          'SnapInterfaceController:getInterface',
          MOCK_SNAP_ID,
          'test',
        ),
      ).toThrow(`Interface with id 'test' not found.`);
    });
  });

  describe('updateInterface', () => {
    it('can update an interface', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const newContent = form({
        name: 'foo',
        children: [input({ name: 'baz' })],
      });

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      await rootMessenger.call(
        'SnapInterfaceController:updateInterface',
        MOCK_SNAP_ID,
        id,
        newContent,
      );

      const { content, state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(content).toStrictEqual(getJsxElementFromComponent(newContent));
      expect(state).toStrictEqual({ foo: { baz: null } });
    });

    it('can update an interface using JSX', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Form name="foo">
          <Field label="Bar">
            <Input name="bar" type="text" />
          </Field>
        </Form>
      );

      const newElement = (
        <Form name="foo">
          <Field label="Baz">
            <Input name="baz" type="text" />
          </Field>
        </Form>
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        element,
      );

      await rootMessenger.call(
        'SnapInterfaceController:updateInterface',
        MOCK_SNAP_ID,
        id,
        newElement,
      );

      const { content, state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(content).toStrictEqual(newElement);
      expect(state).toStrictEqual({ foo: { baz: null } });
    });

    it('throws if a link is on the phishing list', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      rootMessenger.registerActionHandler(
        'PhishingController:maybeUpdateState',
        jest.fn(),
      );

      rootMessenger.registerActionHandler(
        'PhishingController:testOrigin',
        () => ({ result: true, type: 'all' }),
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const newContent = panel([
        text('[foo](https://foo.bar)'),
        form({
          name: 'foo',
          children: [input({ name: 'baz' })],
        }),
      ]);

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          id,
          newContent,
        ),
      ).rejects.toThrow('Invalid URL: The specified URL is not allowed.');

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        4,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        5,
        'PhishingController:testOrigin',
        'foo.bar',
      );
    });

    it('throws if a JSX link is on the phishing list', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger = getRestrictedSnapInterfaceControllerMessenger(
        rootMessenger,
        false,
      );

      rootMessenger.registerActionHandler(
        'PhishingController:maybeUpdateState',
        jest.fn(),
      );

      rootMessenger.registerActionHandler(
        'PhishingController:testOrigin',
        () => ({ result: true, type: 'all' }),
      );

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Form name="foo">
          <Field label="Bar">
            <Input name="bar" type="text" />
          </Field>
        </Form>
      );

      const newElement = (
        <Box>
          <Text>
            Foo <Link href="https://foo.bar">Bar</Link>
          </Text>
          {element}
        </Box>
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        element,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          id,
          newElement,
        ),
      ).rejects.toThrow('Invalid URL: The specified URL is not allowed.');

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        4,
        'PhishingController:maybeUpdateState',
      );

      expect(rootMessenger.call).toHaveBeenNthCalledWith(
        5,
        'PhishingController:testOrigin',
        'foo.bar',
      );
    });

    it('throws if UI content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const images = new Array(800_000).fill(image(`<svg />`));
      const newContent = panel(images);

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          id,
          newContent,
        ),
      ).rejects.toThrow('A Snap UI may not be larger than 10 MB.');
    });

    it('throws if JSX UI content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const element = (
        <Form name="foo">
          <Field label="Bar">
            <Input name="bar" type="text" />
          </Field>
        </Form>
      );

      const newElement = (
        <Box>{new Array(800_000).fill(<Image src={'<svg />'} />)}</Box>
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        element,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          id,
          newElement,
        ),
      ).rejects.toThrow('A Snap UI may not be larger than 10 MB.');
    });

    it('throws if text content is too large', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const components = form({
        name: 'foo',
        children: [input({ name: 'bar' })],
      });

      const newContent = panel([text('[foo](https://foo.bar)'.repeat(2500))]);

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        components,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          id,
          newContent,
        ),
      ).rejects.toThrow('The text in a Snap UI may not be larger than 50 kB.');
    });

    it('throws if the interface does not exist', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const content = form({ name: 'foo', children: [input({ name: 'bar' })] });

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          MOCK_SNAP_ID,
          'foo',
          content,
        ),
      ).rejects.toThrow("Interface with id 'foo' not found.");
    });

    it('throws if the interface is updated by another snap', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const content = form({ name: 'foo', children: [input({ name: 'bar' })] });

      const newContent = form({
        name: 'foo',
        children: [input({ name: 'baz' })],
      });

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        content,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:updateInterface',
          'foo' as SnapId,
          id,
          newContent,
        ),
      ).rejects.toThrow('Interface not created by foo.');
    });
  });

  describe('updateInterfaceState', () => {
    it('updates the interface state', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const content = form({ name: 'foo', children: [input({ name: 'bar' })] });

      const newState = { foo: { bar: 'baz' } };

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        content,
      );

      rootMessenger.call(
        'SnapInterfaceController:updateInterfaceState',
        id,
        newState,
      );

      const { state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(state).toStrictEqual(newState);
    });

    it('updates the interface state with a file', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const content = (
        <Form name="foo">
          <Field label="Bar">
            <FileInput name="bar" />
          </Field>
        </Form>
      );

      const newState = {
        foo: {
          bar: {
            name: 'test.png',
            size: 123,
            contentType: 'image/png',
            contents: 'foo',
          },
        },
      };

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        content,
      );

      rootMessenger.call(
        'SnapInterfaceController:updateInterfaceState',
        id,
        newState,
      );

      const { state } = rootMessenger.call(
        'SnapInterfaceController:getInterface',
        MOCK_SNAP_ID,
        id,
      );

      expect(state).toStrictEqual(newState);
    });
  });

  describe('deleteInterface', () => {
    it('can delete an interface', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const content = form({ name: 'foo', children: [input({ name: 'bar' })] });

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        content,
      );

      rootMessenger.call('SnapInterfaceController:deleteInterface', id);

      expect(() =>
        rootMessenger.call(
          'SnapInterfaceController:getInterface',
          MOCK_SNAP_ID,
          id,
        ),
      ).toThrow(`Interface with id '${id}' not found.`);
    });
  });

  describe('resolveInterface', () => {
    it('resolves the interface with the given value', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const approvalControllerMock = new MockApprovalController();

      rootMessenger.registerActionHandler(
        'ApprovalController:hasRequest',
        approvalControllerMock.hasRequest.bind(approvalControllerMock),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:acceptRequest',
        approvalControllerMock.acceptRequest.bind(approvalControllerMock),
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        <Box>
          <Text>foo</Text>
        </Box>,
      );

      const approvalPromise = approvalControllerMock.addRequest({
        id,
      });

      rootMessenger.call(
        'SnapInterfaceController:resolveInterface',
        MOCK_SNAP_ID,
        id,
        'bar',
      );

      expect(await approvalPromise).toBe('bar');
    });

    it('throws if the interface does not exist', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const approvalControllerMock = new MockApprovalController();

      rootMessenger.registerActionHandler(
        'ApprovalController:hasRequest',
        approvalControllerMock.hasRequest.bind(approvalControllerMock),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:acceptRequest',
        approvalControllerMock.acceptRequest.bind(approvalControllerMock),
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:resolveInterface',
          MOCK_SNAP_ID,
          'foo',
          'bar',
        ),
      ).rejects.toThrow(`Interface with id 'foo' not found.`);
    });

    it('throws if the interface is resolved by another snap', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const approvalControllerMock = new MockApprovalController();

      rootMessenger.registerActionHandler(
        'ApprovalController:hasRequest',
        approvalControllerMock.hasRequest.bind(approvalControllerMock),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:acceptRequest',
        approvalControllerMock.acceptRequest.bind(approvalControllerMock),
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        <Box>
          <Text>foo</Text>
        </Box>,
      );

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      approvalControllerMock.addRequest({
        id,
      });

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:resolveInterface',
          'baz' as SnapId,
          id,
          'bar',
        ),
      ).rejects.toThrow('Interface not created by baz.');
    });

    it('throws if the interface has no approval request', async () => {
      const rootMessenger = getRootSnapInterfaceControllerMessenger();
      const controllerMessenger =
        getRestrictedSnapInterfaceControllerMessenger(rootMessenger);

      /* eslint-disable-next-line no-new */
      new SnapInterfaceController({
        messenger: controllerMessenger,
      });

      const approvalControllerMock = new MockApprovalController();

      rootMessenger.registerActionHandler(
        'ApprovalController:hasRequest',
        approvalControllerMock.hasRequest.bind(approvalControllerMock),
      );

      rootMessenger.registerActionHandler(
        'ApprovalController:acceptRequest',
        approvalControllerMock.acceptRequest.bind(approvalControllerMock),
      );

      const id = await rootMessenger.call(
        'SnapInterfaceController:createInterface',
        MOCK_SNAP_ID,
        <Box>
          <Text>foo</Text>
        </Box>,
      );

      await expect(
        rootMessenger.call(
          'SnapInterfaceController:resolveInterface',
          MOCK_SNAP_ID,
          id,
          'bar',
        ),
      ).rejects.toThrow(`Approval request with id '${id}' not found.`);
    });
  });
});
