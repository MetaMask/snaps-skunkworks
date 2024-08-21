import { VirtualFile } from '@metamask/snaps-utils';
import {
  getMockSnapFiles,
  getSnapManifest,
} from '@metamask/snaps-utils/test-utils';
import { assert } from '@metamask/utils';

import {
  LoopbackLocation,
  MOCK_ALLOWED_RPC_ORIGINS_PERMISSION,
  MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
  MOCK_LIFECYCLE_HOOKS_PERMISSION,
  MOCK_RPC_ORIGINS_PERMISSION,
  MOCK_SNAP_DIALOG_PERMISSION,
} from './test-utils';
import { getSnapFiles, permissionsDiff, setDiff } from './utils';
import { SnapEndowments } from '../../snaps-rpc-methods/src/endowments';

describe('setDiff', () => {
  it('does nothing on empty type {}-B', () => {
    expect(setDiff({}, { a: 'foo' })).toStrictEqual({});
  });

  it('does nothing on empty type A-{}', () => {
    expect(setDiff({ a: 'foo', b: 'bar' }, {})).toStrictEqual({
      a: 'foo',
      b: 'bar',
    });
  });

  it('does a difference', () => {
    expect(setDiff({ a: 'foo', b: 'bar' }, { a: 0 })).toStrictEqual({
      b: 'bar',
    });
  });

  it('additional B properties have no effect in A-B', () => {
    expect(
      setDiff({ a: 'foo', b: 'bar' }, { b: 0, c: 'foobar' }),
    ).toStrictEqual({ a: 'foo' });
  });

  it('works for the same object A-A', () => {
    const object = { a: 'foo', b: 'bar' };
    expect(setDiff(object, object)).toStrictEqual({});
  });
});

describe('permissionsDiff', () => {
  it('does nothing on empty type {}-B', () => {
    expect(
      permissionsDiff(
        {},
        { [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION },
      ),
    ).toStrictEqual({});
  });

  it('does nothing on empty type A-{}', () => {
    expect(
      permissionsDiff(
        { [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION },
        {},
      ),
    ).toStrictEqual({
      [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
    });
  });

  it('does a difference', () => {
    expect(
      permissionsDiff(
        {
          [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
          [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
        },
        { [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION },
      ),
    ).toStrictEqual({
      [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
    });
  });

  it('additional B permissions have no effect in A-B', () => {
    expect(
      permissionsDiff(
        {
          [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
          [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
        },
        {
          [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          snap_dialog: MOCK_SNAP_DIALOG_PERMISSION,
        },
      ),
    ).toStrictEqual({
      [SnapEndowments.LifecycleHooks]: MOCK_LIFECYCLE_HOOKS_PERMISSION,
    });
  });

  it('considers caveats in diff', () => {
    expect(
      permissionsDiff(
        {
          [SnapEndowments.Rpc]: MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
        },
        {
          [SnapEndowments.Rpc]: MOCK_ALLOWED_RPC_ORIGINS_PERMISSION,
        },
      ),
    ).toStrictEqual({
      [SnapEndowments.Rpc]: MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
    });

    expect(
      permissionsDiff(
        {
          [SnapEndowments.Rpc]: MOCK_ALLOWED_RPC_ORIGINS_PERMISSION,
        },
        {
          [SnapEndowments.Rpc]: MOCK_DAPPS_RPC_ORIGINS_PERMISSION,
        },
      ),
    ).toStrictEqual({
      [SnapEndowments.Rpc]: MOCK_ALLOWED_RPC_ORIGINS_PERMISSION,
    });
  });

  it('works for the same permissions A-A', () => {
    const object = { [SnapEndowments.Rpc]: MOCK_RPC_ORIGINS_PERMISSION };
    expect(permissionsDiff(object, object)).toStrictEqual({});
  });
});

describe('getSnapFiles', () => {
  it('returns an empty array if `files` is undefined', async () => {
    const location = new LoopbackLocation();
    expect(await getSnapFiles(location)).toStrictEqual([]);
  });

  it('returns an empty array if `files` is an empty array', async () => {
    const location = new LoopbackLocation();
    expect(await getSnapFiles(location, [])).toStrictEqual([]);
  });

  it('gets the files from the specified location', async () => {
    const { manifest, sourceCode, svgIcon } = getMockSnapFiles({
      manifest: getSnapManifest(),
    });

    assert(svgIcon);
    const location = new LoopbackLocation({
      manifest,
      files: [
        sourceCode,
        svgIcon,
        new VirtualFile({
          path: 'foo.json',
          value: 'foo',
        }),
        new VirtualFile({
          path: 'bar.json',
          value: 'bar',
        }),
      ],
    });

    expect(
      await getSnapFiles(location, ['foo.json', 'bar.json']),
    ).toStrictEqual([
      new VirtualFile({
        path: 'foo.json',
        value: 'foo',
      }),
      new VirtualFile({
        path: 'bar.json',
        value: 'bar',
      }),
    ]);
  });
});
