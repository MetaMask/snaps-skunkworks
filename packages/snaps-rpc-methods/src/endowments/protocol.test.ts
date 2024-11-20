import { PermissionType, SubjectType } from '@metamask/permission-controller';
import { SnapCaveatType } from '@metamask/snaps-utils';

import { SnapEndowments } from './enum';
import {
  getProtocolCaveatMapper,
  getProtocolCaveatScopes,
  protocolCaveatSpecifications,
  protocolEndowmentBuilder,
} from './protocol';

describe('endowment:protocol', () => {
  it('builds the expected permission specification', () => {
    const specification = protocolEndowmentBuilder.specificationBuilder({});
    expect(specification).toStrictEqual({
      permissionType: PermissionType.Endowment,
      targetName: SnapEndowments.Protocol,
      endowmentGetter: expect.any(Function),
      allowedCaveats: [
        SnapCaveatType.ProtocolSnapScopes,
        SnapCaveatType.MaxRequestTime,
      ],
      subjectTypes: [SubjectType.Snap],
      validator: expect.any(Function),
    });

    expect(specification.endowmentGetter()).toBeNull();
  });

  describe('validator', () => {
    it('throws if the caveat is not a single "protocolSnapScopes"', () => {
      const specification = protocolEndowmentBuilder.specificationBuilder({});

      expect(() =>
        specification.validator({
          // @ts-expect-error Missing other required permission types.
          caveats: undefined,
        }),
      ).toThrow('Expected the following caveats: "protocolSnapScopes".');

      expect(() =>
        // @ts-expect-error Missing other required permission types.
        specification.validator({
          caveats: [{ type: 'foo', value: 'bar' }],
        }),
      ).toThrow(
        'Expected the following caveats: "protocolSnapScopes", "maxRequestTime", received "foo".',
      );

      expect(() =>
        // @ts-expect-error Missing other required permission types.
        specification.validator({
          caveats: [
            { type: SnapCaveatType.ProtocolSnapScopes, value: 'bar' },
            { type: SnapCaveatType.ProtocolSnapScopes, value: 'bar' },
          ],
        }),
      ).toThrow('Duplicate caveats are not allowed.');
    });
  });
});

describe('getProtocolCaveatMapper', () => {
  it('maps a value to a caveat', () => {
    expect(
      getProtocolCaveatMapper({
        scopes: {
          'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
            methods: ['getVersion'],
          },
        },
      }),
    ).toStrictEqual({
      caveats: [
        {
          type: SnapCaveatType.ProtocolSnapScopes,
          value: {
            'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
              methods: ['getVersion'],
            },
          },
        },
      ],
    });
  });

  it('returns null if value is empty', () => {
    expect(getProtocolCaveatMapper({})).toStrictEqual({ caveats: null });
  });
});

describe('getProtocolCaveatScopes', () => {
  it('returns the scopes from the caveat', () => {
    expect(
      // @ts-expect-error Missing other required permission types.
      getProtocolCaveatScopes({
        caveats: [
          {
            type: SnapCaveatType.ProtocolSnapScopes,
            value: {
              'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
                methods: ['getVersion'],
              },
            },
          },
        ],
      }),
    ).toStrictEqual({
      'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
        methods: ['getVersion'],
      },
    });
  });

  it('returns null if no caveat found', () => {
    expect(
      // @ts-expect-error Missing other required permission types.
      getProtocolCaveatScopes({
        caveats: null,
      }),
    ).toBeNull();
  });
});

describe('protocolCaveatSpecifications', () => {
  describe('validator', () => {
    it('throws if the caveat values are invalid', () => {
      expect(() =>
        protocolCaveatSpecifications[
          SnapCaveatType.ProtocolSnapScopes
        ].validator?.(
          // @ts-expect-error Missing value type.
          {
            type: SnapCaveatType.ProtocolSnapScopes,
          },
        ),
      ).toThrow('Expected a plain object.');

      expect(() =>
        protocolCaveatSpecifications[
          SnapCaveatType.ProtocolSnapScopes
        ].validator?.({
          type: SnapCaveatType.ProtocolSnapScopes,
          value: {
            foo: 'bar',
          },
        }),
      ).toThrow(
        'Invalid scopes specified: At path: foo -- Expected a string matching `/^(?<namespace>[-a-z0-9]{3,8}):(?<reference>[-_a-zA-Z0-9]{1,32})$/` but received "foo".',
      );
    });
  });
});
