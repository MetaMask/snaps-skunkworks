import type { PermissionConstraint } from '@metamask/permission-controller';
import type { Json } from '@metamask/utils';

import {
  permittedCoinTypesCaveatMapper,
  PermittedCoinTypesCaveatSpecification,
} from './permittedCoinTypes';
import {
  permittedDerivationPathsCaveatMapper,
  PermittedDerivationPathsCaveatSpecification,
} from './permittedDerivationPaths';
import { snapIdsCaveatMapper, SnapIdsCaveatSpecification } from './snapIds';
import { getBip32EntropyBuilder } from '../getBip32Entropy';
import { getBip32PublicKeyBuilder } from '../getBip32PublicKey';
import { getBip44EntropyBuilder } from '../getBip44Entropy';
import { invokeSnapBuilder } from '../invokeSnap';

export const caveatSpecifications = {
  ...PermittedDerivationPathsCaveatSpecification,
  ...PermittedCoinTypesCaveatSpecification,
  ...SnapIdsCaveatSpecification,
} as const;

export const caveatMappers: Record<
  string,
  (value: Json) => Pick<PermissionConstraint, 'caveats'>
> = {
  [getBip32EntropyBuilder.targetName]: permittedDerivationPathsCaveatMapper,
  [getBip32PublicKeyBuilder.targetName]: permittedDerivationPathsCaveatMapper,
  [getBip44EntropyBuilder.targetName]: permittedCoinTypesCaveatMapper,
  [invokeSnapBuilder.targetName]: snapIdsCaveatMapper,
};
