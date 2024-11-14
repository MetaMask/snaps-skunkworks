import type {
  Caveat,
  CaveatConstraint,
  CaveatSpecificationConstraint,
  EndowmentGetterParams,
  PermissionConstraint,
  PermissionSpecificationBuilder,
  PermissionValidatorConstraint,
  ValidPermissionSpecification,
} from '@metamask/permission-controller';
import { PermissionType, SubjectType } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import { ProtocolScopesStruct, SnapCaveatType } from '@metamask/snaps-utils';
import type { Infer } from '@metamask/superstruct';
import type { Json, NonEmptyArray } from '@metamask/utils';
import {
  assertStruct,
  hasProperty,
  isObject,
  isPlainObject,
} from '@metamask/utils';

import { createGenericPermissionValidator } from './caveats';
import { SnapEndowments } from './enum';

const permissionName = SnapEndowments.Protocol;

type ProtocolEndowmentSpecification = ValidPermissionSpecification<{
  permissionType: PermissionType.Endowment;
  targetName: typeof permissionName;
  endowmentGetter: (_options?: EndowmentGetterParams) => null;
  allowedCaveats: Readonly<NonEmptyArray<string>> | null;
  validator: PermissionValidatorConstraint;
  subjectTypes: readonly SubjectType[];
}>;

/**
 * `endowment:protocol` returns nothing; it is intended to be used as a flag
 * by the client to detect whether the Snap supports the Protocol API.
 *
 * @param _builderOptions - Optional specification builder options.
 * @returns The specification for the accounts chain endowment.
 */
const specificationBuilder: PermissionSpecificationBuilder<
  PermissionType.Endowment,
  any,
  ProtocolEndowmentSpecification
> = (_builderOptions?: unknown) => {
  return {
    permissionType: PermissionType.Endowment,
    targetName: permissionName,
    allowedCaveats: [SnapCaveatType.ChainIds, SnapCaveatType.MaxRequestTime],
    endowmentGetter: (_getterOptions?: EndowmentGetterParams) => null,
    validator: createGenericPermissionValidator([
      { type: SnapCaveatType.ProtocolSnapScopes },
      { type: SnapCaveatType.MaxRequestTime, optional: true },
    ]),
    subjectTypes: [SubjectType.Snap],
  };
};

export const protocolEndowmentBuilder = Object.freeze({
  targetName: permissionName,
  specificationBuilder,
} as const);

/**
 * Map a raw value from the `initialPermissions` to a caveat specification.
 * Note that this function does not do any validation, that's handled by the
 * PermissionsController when the permission is requested.
 *
 * @param value - The raw value from the `initialPermissions`.
 * @returns The caveat specification.
 */
export function getProtocolCaveatMapper(
  value: Json,
): Pick<PermissionConstraint, 'caveats'> {
  if (!value || !isObject(value) || Object.keys(value).length === 0) {
    return { caveats: null };
  }

  const caveats = [];

  if (value.chains) {
    caveats.push({
      type: SnapCaveatType.ProtocolSnapScopes,
      value: value.chains,
    });
  }

  return { caveats: caveats as NonEmptyArray<CaveatConstraint> };
}

export type ProtocolScopes = Infer<typeof ProtocolScopesStruct>;

/**
 * Getter function to get the {@link ProtocolSnapScopes} caveat value from a
 * permission.
 *
 * @param permission - The permission to get the caveat value from.
 * @returns The caveat value.
 */
export function getProtocolCaveatScopes(
  permission?: PermissionConstraint,
): ProtocolScopes | null {
  const caveat = permission?.caveats?.find(
    (permCaveat) => permCaveat.type === SnapCaveatType.ProtocolSnapScopes,
  ) as Caveat<string, ProtocolScopes> | undefined;

  return caveat ? caveat.value : null;
}

/**
 * Validates the type of the caveat value.
 *
 * @param caveat - The caveat to validate.
 * @throws If the caveat value is invalid.
 */
function validateCaveat(caveat: Caveat<string, any>): void {
  if (!hasProperty(caveat, 'value') || !isPlainObject(caveat)) {
    throw rpcErrors.invalidParams({
      message: 'Expected a plain object.',
    });
  }

  const { value } = caveat;
  assertStruct(
    value,
    ProtocolScopesStruct,
    'Invalid chains specified',
    rpcErrors.invalidParams,
  );
}

export const protocolCaveatSpecifications: Record<
  SnapCaveatType.ProtocolSnapScopes,
  CaveatSpecificationConstraint
> = {
  [SnapCaveatType.ProtocolSnapScopes]: Object.freeze({
    type: SnapCaveatType.ProtocolSnapScopes,
    validator: (caveat: Caveat<string, any>) => validateCaveat(caveat),
  }),
};
