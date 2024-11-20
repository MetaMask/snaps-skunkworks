import { PermissionType, SubjectType } from '@metamask/permission-controller';
import { SnapCaveatType } from '@metamask/snaps-utils';

import { SnapEndowments } from './enum';
import {
  getKeyringCaveatMapper,
  getKeyringCaveatOrigins,
  keyringCaveatSpecifications,
  keyringEndowmentBuilder,
} from './keyring';

describe('endowment:keyring', () => {
  it('builds the expected permission specification', () => {
    const specification = keyringEndowmentBuilder.specificationBuilder({});
    expect(specification).toStrictEqual({
      permissionType: PermissionType.Endowment,
      targetName: SnapEndowments.Keyring,
      endowmentGetter: expect.any(Function),
      allowedCaveats: [
        SnapCaveatType.KeyringOrigin,
        SnapCaveatType.MaxRequestTime,
      ],
      subjectTypes: [SubjectType.Snap],
      validator: expect.any(Function),
    });

    expect(specification.endowmentGetter()).toBeNull();
  });

  describe('validator', () => {
    it('throws if the caveat is not a single "keyringOrigin"', () => {
      const specification = keyringEndowmentBuilder.specificationBuilder({});

      expect(() =>
        specification.validator({
          // @ts-expect-error Missing other required permission types.
          caveats: undefined,
        }),
      ).toThrow('Expected the following caveats: "keyringOrigin".');

      expect(() =>
        // @ts-expect-error Missing other required permission types.
        specification.validator({
          caveats: [{ type: 'foo', value: 'bar' }],
        }),
      ).toThrow(
        'Expected the following caveats: "keyringOrigin", "maxRequestTime", received "foo".',
      );

      expect(() =>
        // @ts-expect-error Missing other required permission types.
        specification.validator({
          caveats: [
            { type: 'keyringOrigin', value: { allowedOrgins: ['foo.com'] } },
            { type: 'keyringOrigin', value: { allowedOrgins: ['bar.com'] } },
          ],
        }),
      ).toThrow('Duplicate caveats are not allowed.');
    });
  });
});

describe('getKeyringCaveatMapper', () => {
  it('maps a value to a caveat', () => {
    expect(
      getKeyringCaveatMapper({ allowedOrigins: ['foo.com'] }),
    ).toStrictEqual({
      caveats: [
        {
          type: SnapCaveatType.KeyringOrigin,
          value: { allowedOrigins: ['foo.com'] },
        },
      ],
    });
  });
});

describe('getKeyringCaveatOrigins', () => {
  it('returns the origins from the caveat', () => {
    expect(
      // @ts-expect-error Missing other required permission types.
      getKeyringCaveatOrigins({
        caveats: [
          {
            type: SnapCaveatType.KeyringOrigin,
            value: { allowedOrigins: ['foo.com'] },
          },
        ],
      }),
    ).toStrictEqual({ allowedOrigins: ['foo.com'] });
  });

  it('throws if the caveat is not a single "rpcOrigin"', () => {
    expect(() =>
      // @ts-expect-error Missing other required permission types.
      getKeyringCaveatOrigins({
        caveats: [{ type: 'foo', value: 'bar' }],
      }),
    ).toThrow('Assertion failed.');

    expect(() =>
      // @ts-expect-error Missing other required permission types.
      getKeyringCaveatOrigins({
        caveats: [
          { type: 'keyringOrigin', value: { allowedOrigins: ['foo.com'] } },
          { type: 'keyringOrigin', value: { allowedOrigins: ['foo.com'] } },
        ],
      }),
    ).toThrow('Assertion failed.');
  });
});

describe('keyringCaveatSpecifications', () => {
  describe('validator', () => {
    it('throws if the caveat values are invalid', () => {
      expect(() =>
        keyringCaveatSpecifications[SnapCaveatType.KeyringOrigin].validator?.(
          // @ts-expect-error Missing value type.
          {
            type: SnapCaveatType.KeyringOrigin,
          },
        ),
      ).toThrow('Invalid keyring origins: Expected a plain object.');

      expect(() =>
        keyringCaveatSpecifications[SnapCaveatType.KeyringOrigin].validator?.({
          type: SnapCaveatType.KeyringOrigin,
          value: {
            foo: 'bar',
          },
        }),
      ).toThrow(
        'Invalid keyring origins: At path: foo -- Expected a value of type `never`, but received: `"bar"`.',
      );
    });
  });
});
