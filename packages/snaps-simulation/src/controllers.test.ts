import { Messenger } from '@metamask/base-controller';
import {
  PermissionController,
  SubjectMetadataController,
} from '@metamask/permission-controller';

import { getControllers } from './controllers';
import type { RestrictedMiddlewareHooks } from './simulation';
import { getMockOptions } from './test-utils';

const MOCK_HOOKS: RestrictedMiddlewareHooks = {
  getIsLocked: jest.fn(),
  getMnemonic: jest.fn(),
  getSnapFile: jest.fn(),
  createInterface: jest.fn(),
  updateInterface: jest.fn(),
  getInterfaceState: jest.fn(),
  resolveInterface: jest.fn(),
};

describe('getControllers', () => {
  it('returns the controllers', () => {
    const { permissionController, subjectMetadataController } = getControllers({
      controllerMessenger: new Messenger(),
      hooks: MOCK_HOOKS,
      runSaga: jest.fn(),
      options: getMockOptions(),
    });

    expect(permissionController).toBeInstanceOf(PermissionController);
    expect(subjectMetadataController).toBeInstanceOf(SubjectMetadataController);
  });
});
