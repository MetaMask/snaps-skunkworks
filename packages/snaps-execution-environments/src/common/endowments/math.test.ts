import math from './math';
import { rootRealmGlobal } from '../globalObject';

describe('Math endowment', () => {
  it('has expected properties', () => {
    expect(math).toMatchObject({
      names: ['Math'],
      factory: expect.any(Function),
    });
  });

  it('returns Math from rootRealmGlobal', () => {
    const { Math } = math.factory();
    expect(Math.abs).toStrictEqual(rootRealmGlobal.Math.abs);
  });

  describe('random', () => {
    it('does not return the original Math.random', () => {
      const { Math } = math.factory();
      expect(Math.random).not.toStrictEqual(rootRealmGlobal.Math.random);
    });

    it('returns a random number without calling the original Math.random', () => {
      const { Math } = math.factory();
      const randomSpy = jest.spyOn(rootRealmGlobal.Math, 'random');

      expect(Math.random()).toStrictEqual(expect.any(Number));
      expect(randomSpy).not.toHaveBeenCalled();
    });

    it('returns an number in the range [0, 1)', () => {
      const { Math } = math.factory();
      const value = Math.random();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });
});
