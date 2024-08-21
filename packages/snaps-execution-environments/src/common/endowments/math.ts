import { createCrypto } from './crypto';
import { rootRealmGlobal } from '../globalObject';

/**
 * Create a {@link Math} object, with the same properties as the global
 * {@link Math} object, but with the {@link Math.random} method replaced.
 *
 * @returns The {@link Math} object with the {@link Math.random} method
 * replaced.
 */
function createMath() {
  // `Math` does not work with `Object.keys`, `Object.entries`, etc., so we
  // need to create a new object with the same properties.
  const keys = Object.getOwnPropertyNames(
    rootRealmGlobal.Math,
  ) as (keyof typeof Math)[];

  const math = keys.reduce<Partial<Math>>((target, key) => {
    if (key === 'random') {
      return target;
    }

    return { ...target, [key]: rootRealmGlobal.Math[key] };
  }, {});

  // Since the math endowment requires crypto, we can leverage the crypto endowment factory to get a hardened and platform agnostic instance of webcrypto
  const { crypto: hardenedCrypto } = createCrypto();

  return harden({
    Math: {
      ...math,
      random: () => {
        // NOTE: This is not intended to be a secure replacement for the weak
        // random number generator used by `Math.random`. It is only intended to
        // prevent side channel attacks of `Math.random` by replacing it with an
        // alternative implementation that is not vulnerable to the same
        // attacks.
        //
        // This does not mean that this implementation is secure. It is not
        // intended to be used in a security context, and this implementation
        // may change at any time.
        //
        // To securely generate random numbers, use a cryptographically secure
        // random number generator, such as the one provided by the Web Crypto
        // API:
        //
        // - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
        // - https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
        return hardenedCrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
      },
    },
  });
}

const endowmentModule = {
  names: ['Math'] as const,
  factory: createMath,
};

export default endowmentModule;
