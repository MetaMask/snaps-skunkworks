import type { StreamProvider } from '@metamask/providers';
import { rpcErrors } from '@metamask/rpc-errors';
import type { SnapsProvider } from '@metamask/snaps-sdk';
import { logWarning } from '@metamask/snaps-utils';
import { hasProperty } from '@metamask/utils';

import type { EndowmentFactoryOptions } from './commonEndowmentFactory';
import buildCommonEndowments from './commonEndowmentFactory';
import type { NotifyFunction } from '../BaseSnapExecutor';
import { rootRealmGlobal } from '../globalObject';

type EndowmentFactoryResult = {
  /**
   * A function that performs any necessary teardown when the snap becomes idle.
   *
   * NOTE:** The endowments are not reconstructed if the snap is re-invoked
   * before being terminated, so the teardown operation must not render the
   * endowments unusable; it should simply restore the endowments to their
   * original state.
   */
  teardownFunction?: () => Promise<void> | void;
  [key: string]: unknown;
};

/**
 * Retrieve consolidated endowment factories for common endowments.
 */
const registeredEndowments = buildCommonEndowments();

/**
 * A map of endowment names to their factory functions. Some endowments share
 * the same factory function, but we only call each factory once for each snap.
 * See {@link createEndowments} for details.
 */
const endowmentFactories = registeredEndowments.reduce((factories, builder) => {
  builder.names.forEach((name) => {
    factories.set(name, builder.factory);
  });
  return factories;
}, new Map<string, (options?: EndowmentFactoryOptions) => EndowmentFactoryResult>());

/**
 * Gets the endowments for a particular Snap. Some endowments, like `setTimeout`
 * and `clearTimeout`, must be attenuated so that they can only affect behavior
 * within the Snap's own realm. Therefore, we use factory functions to create
 * such attenuated / modified endowments. Otherwise, the value that's on the
 * root realm global will be used.
 *
 * @param options - An options bag.
 * @param options.snap - The Snaps global API object.
 * @param options.ethereum - The Snap's EIP-1193 provider object.
 * @param options.snapId - The id of the snap that will use the created endowments.
 * @param options.endowments - The list of endowments to provide to the snap.
 * @param options.notify - A reference to the notify function of the snap executor.
 * @returns An object containing the Snap's endowments.
 */
export function createEndowments({
  snap,
  ethereum,
  snapId,
  endowments,
  notify,
}: {
  snap: SnapsProvider;
  ethereum: StreamProvider;
  snapId: string;
  endowments: string[];
  notify: NotifyFunction;
}): { endowments: Record<string, unknown>; teardown: () => Promise<void> } {
  const attenuatedEndowments: Record<string, unknown> = {};

  // TODO: All endowments should be hardened to prevent covert communication
  // channels. Hardening the returned objects breaks tests elsewhere in the
  // monorepo, so further research is needed.
  const result = endowments.reduce<{
    allEndowments: Record<string, unknown>;
    teardowns: (() => Promise<void> | void)[];
  }>(
    ({ allEndowments, teardowns }, endowmentName) => {
      // First, check if the endowment has a factory, and default to that.
      if (endowmentFactories.has(endowmentName)) {
        if (!hasProperty(attenuatedEndowments, endowmentName)) {
          // Call the endowment factory for the current endowment. If the factory
          // creates multiple endowments, they will all be assigned to the
          // `attenuatedEndowments` object, but will only be passed on to the snap
          // if explicitly listed among its endowment.
          // This may not have an actual use case, but, safety first.

          // We just confirmed that endowmentFactories has the specified key.
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const { teardownFunction, ...endowment } = endowmentFactories.get(
            endowmentName,
          )!({ snapId, notify });
          Object.assign(attenuatedEndowments, endowment);
          if (teardownFunction) {
            teardowns.push(teardownFunction);
          }
        }
        allEndowments[endowmentName] = attenuatedEndowments[endowmentName];
      } else if (endowmentName === 'ethereum') {
        // Special case for adding the EIP-1193 provider.
        allEndowments[endowmentName] = ethereum;
      } else if (endowmentName in rootRealmGlobal) {
        logWarning(`Access to unhardened global ${endowmentName}.`);
        // If the endowment doesn't have a factory, just use whatever is on the
        // global object.
        const globalValue = (rootRealmGlobal as Record<string, unknown>)[
          endowmentName
        ];
        allEndowments[endowmentName] = globalValue;
      } else {
        // If we get to this point, we've been passed an endowment that doesn't
        // exist in our current environment.
        throw rpcErrors.internal(`Unknown endowment: "${endowmentName}".`);
      }
      return { allEndowments, teardowns };
    },
    {
      allEndowments: { snap },
      teardowns: [],
    },
  );

  const teardown = async () => {
    await Promise.all(
      result.teardowns.map(async (teardownFunction) => teardownFunction()),
    );
  };
  return { endowments: result.allEndowments, teardown };
}
