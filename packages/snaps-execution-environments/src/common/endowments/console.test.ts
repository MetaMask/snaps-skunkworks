import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';

import consoleEndowment, {
  consoleAttenuatedMethods,
  consoleMethods,
} from './console';
import { rootRealmGlobal } from '../globalObject';

describe('Console endowment', () => {
  it('has expected properties', () => {
    expect(consoleEndowment).toMatchObject({
      names: ['console'],
      factory: expect.any(Function),
    });
  });

  it('returns console properties from rootRealmGlobal', () => {
    const { console }: { console: Partial<typeof rootRealmGlobal.console> } =
      consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
    const consoleProperties = Object.getOwnPropertyNames(
      rootRealmGlobal.console,
    );
    const unchangedProperties = consoleProperties.filter(
      (property) =>
        consoleMethods.has(property) && !consoleAttenuatedMethods.has(property),
    ) as (keyof typeof rootRealmGlobal.console)[];
    unchangedProperties.forEach((unchangedProperty) => {
      expect(console[unchangedProperty]).toStrictEqual(
        rootRealmGlobal.console[unchangedProperty],
      );
    });
  });

  describe('log', () => {
    it('does not return the original console.log', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.log).not.toStrictEqual(rootRealmGlobal.console.log);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const logSpy = jest.spyOn(rootRealmGlobal.console, 'log');
      console.log('This is a log message.');
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        `[Snap: ${MOCK_SNAP_ID}] This is a log message.`,
      );
    });

    it('can handle non-string message types', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const logSpy = jest.spyOn(rootRealmGlobal.console, 'log');
      console.log(12345);
      console.log({ foo: 'bar' });
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenNthCalledWith(
        1,
        `[Snap: ${MOCK_SNAP_ID}]`,
        12345,
      );
      expect(logSpy).toHaveBeenNthCalledWith(2, `[Snap: ${MOCK_SNAP_ID}]`, {
        foo: 'bar',
      });
    });
  });

  describe('error', () => {
    it('does not return the original console.error', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.error).not.toStrictEqual(rootRealmGlobal.console.error);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const errorSpy = jest.spyOn(rootRealmGlobal.console, 'error');
      console.error('This is an error message.');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        `[Snap: ${MOCK_SNAP_ID}] This is an error message.`,
      );
    });
  });

  describe('assert', () => {
    it('does not return the original console.assert', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.assert).not.toStrictEqual(rootRealmGlobal.console.assert);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const assertSpy = jest.spyOn(rootRealmGlobal.console, 'assert');
      console.assert(1 > 2, 'This is an assert message.');
      expect(assertSpy).toHaveBeenCalledTimes(1);
      expect(assertSpy).toHaveBeenCalledWith(
        false,
        `[Snap: ${MOCK_SNAP_ID}] This is an assert message.`,
      );
    });
  });

  describe('debug', () => {
    it('does not return the original console.debug', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.debug).not.toStrictEqual(rootRealmGlobal.console.debug);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const debugSpy = jest.spyOn(rootRealmGlobal.console, 'debug');
      console.debug('This is a debug message.');
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(
        `[Snap: ${MOCK_SNAP_ID}] This is a debug message.`,
      );
    });
  });

  describe('info', () => {
    it('does not return the original console.info', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.info).not.toStrictEqual(rootRealmGlobal.console.info);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const infoSpy = jest.spyOn(rootRealmGlobal.console, 'info');
      console.info('This is an info message.');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        `[Snap: ${MOCK_SNAP_ID}] This is an info message.`,
      );
    });
  });

  describe('warn', () => {
    it('does not return the original console.warn', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      expect(console.warn).not.toStrictEqual(rootRealmGlobal.console.warn);
    });

    it('will log a message identifying the source of the call (snap id)', () => {
      const { console } = consoleEndowment.factory({ snapId: MOCK_SNAP_ID });
      const warnSpy = jest.spyOn(rootRealmGlobal.console, 'warn');
      console.warn('This is a warn message.');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        `[Snap: ${MOCK_SNAP_ID}] This is a warn message.`,
      );
    });
  });
});
