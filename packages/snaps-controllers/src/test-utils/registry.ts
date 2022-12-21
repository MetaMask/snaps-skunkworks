import { SnapRegistry, SnapRegistryStatus } from '@metamask/snaps-utils';

export class MockSnapRegistry implements SnapRegistry {
  get = jest.fn().mockImplementation(async (snaps) => {
    return Promise.resolve(
      Object.keys(snaps).reduce(
        (acc, snapId) => ({
          ...acc,
          [snapId]: { status: SnapRegistryStatus.Unverified },
        }),
        {},
      ),
    );
  });
}
