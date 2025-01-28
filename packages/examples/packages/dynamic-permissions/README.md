# `@metamask/dynamic-permissions-example-snap`

This Snap demonstrates the use of RPC methods for managing dynamic permissions.

## Snap manifest

> **Note**: Using dynamic permissions requires `dynamicPermissions` property specified in the manifest.
> Refer to [the documentation](https://docs.metamask.io/snaps/reference/rpc-api/#dynamic-permissions)
> for more information.

The manifest of this Snap includes the `dynamicPermissions`property which specifies which permissions can be requested or revoked at the runtime:

```json
{
  "dynamicPermissions": {
    "endowment:network-access": {},
    "endowment:webassembly": {},
    "endowment:ethereum-provider": {},
    "snap_getBip44Entropy": [
      {
        "coinType": 3
      },
      {
        "coinType": 1
      }
    ]
  }
}
```

## Snap usage

This Snap is using following RPC methods for managing dynamic permissions:

- `snap_requestPermissions`: Request dynamic permissions specified in the manifest.
- `snap_getPermissions`: Retrieve all granted permissions.
- `snap_revokePermissions`: Revoke dynamic permissions previously granted.
