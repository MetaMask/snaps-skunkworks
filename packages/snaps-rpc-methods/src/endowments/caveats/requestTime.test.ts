import type { PermissionConstraint } from '@metamask/permission-controller';
import { SnapCaveatType } from '@metamask/snaps-utils';

import {
  createMaxRequestTimeMapper,
  getMaxRequestTimeCaveat,
  getMaxRequestTimeCaveatMapper,
  maxRequestTimeCaveatSpecifications,
} from './requestTime';
import { getCronjobCaveatMapper } from '../cronjob';

describe('maxRequestTimeCaveatSpecifications', () => {
  describe('validator', () => {
    const validator =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      maxRequestTimeCaveatSpecifications[SnapCaveatType.MaxRequestTime]
        .validator!;

    it('throws if caveat value is missing', () => {
      expect(() =>
        validator(
          // @ts-expect-error Missing value type.
          {
            type: SnapCaveatType.MaxRequestTime,
          },
        ),
      ).toThrow('Invalid maxRequestTime caveat.');
    });

    it('throws if caveat value is an integer outside the valid range', () => {
      expect(() =>
        validator({
          type: SnapCaveatType.MaxRequestTime,
          value: 1,
        }),
      ).toThrow(
        'Invalid maxRequestTime: Expected a integer between `5000` and `180000` but received `1`.',
      );
    });

    it('throws if caveat value is not a number', () => {
      expect(() =>
        validator({
          type: SnapCaveatType.MaxRequestTime,
          value: 'foo',
        }),
      ).toThrow(
        'Invalid maxRequestTime: Expected an integer, but received: "foo".',
      );
    });
  });
});

describe('getMaxRequestTimeCaveatMapper', () => {
  it('returns null if the value is not an object', () => {
    expect(getMaxRequestTimeCaveatMapper(null)).toStrictEqual({
      caveats: null,
    });
  });

  it('returns null if the value is an empty object', () => {
    expect(getMaxRequestTimeCaveatMapper({})).toStrictEqual({
      caveats: null,
    });
  });

  it('returns the caveat if it is specified in a valid manner', () => {
    expect(getMaxRequestTimeCaveatMapper({ maxRequestTime: 5 })).toStrictEqual({
      caveats: [{ type: SnapCaveatType.MaxRequestTime, value: 5 }],
    });
  });
});

describe('createMaxRequestTimeMapper', () => {
  const mapper = createMaxRequestTimeMapper(getCronjobCaveatMapper);

  it('ignores maxRequestTime if not present', () => {
    expect(
      mapper({
        jobs: [
          {
            expression: '* * * * *',
            request: {
              method: 'exampleMethodOne',
            },
          },
        ],
      }),
    ).toStrictEqual({
      caveats: [
        {
          type: SnapCaveatType.SnapCronjob,
          value: {
            jobs: [
              {
                expression: '* * * * *',
                request: {
                  method: 'exampleMethodOne',
                },
              },
            ],
          },
        },
      ],
    });
  });

  it('adds maxRequestTime if present', () => {
    expect(
      mapper({
        jobs: [
          {
            expression: '* * * * *',
            request: {
              method: 'exampleMethodOne',
            },
          },
        ],
        maxRequestTime: 5,
      }),
    ).toStrictEqual({
      caveats: [
        {
          type: SnapCaveatType.SnapCronjob,
          value: {
            jobs: [
              {
                expression: '* * * * *',
                request: {
                  method: 'exampleMethodOne',
                },
              },
            ],
          },
        },
        { type: SnapCaveatType.MaxRequestTime, value: 5 },
      ],
    });
  });
});

describe('getMaxRequestTimeCaveat', () => {
  it('returns null if caveat cannot be found', () => {
    const permission: PermissionConstraint = {
      date: 0,
      parentCapability: 'foo',
      invoker: 'bar',
      id: 'baz',
      caveats: [
        {
          type: SnapCaveatType.PermittedCoinTypes,
          value: 'foo',
        },
      ],
    };

    expect(getMaxRequestTimeCaveat(permission)).toBeNull();
  });

  it('returns the caveat if present', () => {
    const permission: PermissionConstraint = {
      date: 0,
      parentCapability: 'foo',
      invoker: 'bar',
      id: 'baz',
      caveats: [
        {
          type: SnapCaveatType.MaxRequestTime,
          value: 5,
        },
      ],
    };

    expect(getMaxRequestTimeCaveat(permission)).toBe(5);
  });
});
