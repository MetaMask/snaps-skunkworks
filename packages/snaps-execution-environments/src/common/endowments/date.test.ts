import date from './date';
import { rootRealmGlobal } from '../globalObject';

describe('Date endowment', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2023-01-01'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('has expected properties', () => {
    expect(date).toMatchObject({
      names: ['Date'],
      factory: expect.any(Function),
    });
  });

  it('has same properties as rootRealmGlobal.Date', () => {
    const { Date } = date.factory();
    expect(Object.getOwnPropertyNames(Date)).toStrictEqual(
      Object.getOwnPropertyNames(rootRealmGlobal.Date),
    );
  });

  describe('constructor', () => {
    it('does not return the original constructor', () => {
      jest.spyOn(rootRealmGlobal.Math, 'random').mockImplementation(() => 0.5);
      const { Date } = date.factory();
      const actual = new rootRealmGlobal.Date();
      const newDate = new Date();
      expect(newDate.getTime()).not.toBe(actual.getTime());
    });

    it('new constructor still supports arguments', () => {
      const { Date } = date.factory();
      expect(new Date(0).getTime()).toBe(0);
    });
  });

  describe('now', () => {
    it('does not return the original Date.now', () => {
      jest.spyOn(rootRealmGlobal.Math, 'random').mockImplementation(() => 0.5);
      const { Date } = date.factory();
      expect(Date.now).not.toStrictEqual(rootRealmGlobal.Date.now);
      expect(Date.now()).not.toBe(rootRealmGlobal.Date.now());
    });
  });
});
