# Permissions

> Based on the [PermissionController architecture documentation](https://github.com/MetaMask/core/blob/main/packages/permission-controller/ARCHITECTURE.md),
> originally written by Erik Marks.

MetaMask Snaps uses the [PermissionController] for managing permissions for
snaps, just like the extension uses it to manage permissions for websites. The
[PermissionController] is the heart of an object capability-inspired permission
system. It is a stateful system that mediates access to resources, and it
provides a mechanism for attenuating the authority granted by a permission.

The [PermissionController] exposes a [JSON-RPC] middleware, which is added to
the JSON-RPC engine of the MetaMask instance. This middleware is responsible
for enforcing the rules of the permission system.

## Overview

The permission system itself belongs to a **host**, like the MetaMask
extension, and it mediates the access to resources – called **targets** – of
distinct **subjects**. A target can belong to the host itself, or another
subject.

When a subject attempts to access a target, we say that they **invoke** it. The
system ensures that subjects can only invoke a target if they have the
**permission** to do so. Permissions are associated with a subject and target,
and they are part of the state of the permission system.

Permissions can have **caveats**, which are host-defined attenuations of the
authority a permission grants over a particular target.

## Implementation

At any given moment, the [PermissionController] state tree describes the
complete state of the permissions of all subjects known to the host (i.e., the
MetaMask instance). The [PermissionController] also provides methods for adding,
updating, and removing permissions, and enforcing the rules described by its
state tree. Permission system concepts correspond to components of the MetaMask
stack as follows:

| Concept           | Implementation                                                  |
| :---------------- | :-------------------------------------------------------------- |
| Host              | The MetaMask application                                        |
| Subjects          | Websites, snaps, or other extensions                            |
| Targets           | JSON-RPC methods, endowments                                    |
| Invocations       | JSON-RPC requests, endowment retrieval                          |
| Permissions       | Permission objects                                              |
| Caveats           | Caveat objects                                                  |
| Permission system | The [PermissionController] and its `json-rpc-engine` middleware |

### Permission and target types

In practice, targets can be different things, necessitating distinct
implementations in order to enforce the logic of the permission system. This
being the case, the [PermissionController] defines different **permission and
target types**, intended for different kinds of permission targets.

#### JSON-RPC Methods

Restricting access to JSON-RPC methods was the motivating and only supported use
case for the original permission system, and remains the predominant kind of
permission to this day. The [PermissionController] provides patterns for
creating restricted JSON-RPC method implementations and caveats, and a
`json-rpc-engine` middleware function factory. To permission a JSON-RPC server,
every JSON-RPC method must be enumerated and designated as either "restricted"
or "unrestricted", and a permission middleware function must be added to the
`json-rpc-engine` middleware stack. Unrestricted methods can always be called
by anyone. Restricted methods require the requisite permission in order to be
called.

Once the permission middleware is injected into the middleware stack, every
JSON-RPC request will be handled in one of the following ways:

- If the requested method is neither restricted nor unrestricted, the request
  will be rejected with a `methodNotFound` error.
- If the requested method is unrestricted, it will pass through the middleware
  unmodified.
- If the requested method is restricted, the middleware will attempt to get the
  permission corresponding to the subject and target, and:
  - If the request is authorized, call the corresponding method with the request
    parameters.
  - If the request is not authorized, reject the request with an `unauthorized`
    error.

#### Endowments

The name "endowment" comes from the endowments that you may provide to
[Secure EcmaScript (SES) `Compartment`](https://github.com/endojs/endo/tree/26d991afb01cf824827db0c958c50970e038112f/packages/ses#compartment)
when it is constructed. SES endowments are simply names that appear in the
compartment's global scope. In the context of the [PermissionController],
endowments are simply "things" that subjects should not be able to access by
default. They _could_ be the names of endowments that are to be made available
to a particular SES `Compartment`, but they could also be any JavaScript value,
and it is the host's responsibility to make sense of them.

### Caveats

Caveats are arbitrary restrictions on restricted method requests. Every
permission has a `caveats` field, which is either an array of caveats or `null`.
Every caveat has a string `type`, and every type has an associated function that
is used to apply the caveat to a restricted method request. When the
[PermissionController] is constructed, the consumer specifies the available
caveat types and their implementations.

#### Caveat mappings

For MetaMask Snaps specifically, each permission that uses caveats has a
"caveat mapper," which is a function that maps a certain value to a valid
caveat. For example, the `snap_getBip32Entropy` permission has a caveat mapper
that maps the value in the snap's manifest to a `PermittedDerivationPaths`
object:

```ts
export function permittedDerivationPathsCaveatMapper(
  value: Json,
): Pick<PermissionConstraint, 'caveats'> {
  return {
    caveats: [
      {
        type: SnapCaveatType.PermittedDerivationPaths,
        value,
      },
    ],
  };
}
```

This makes it easier for snap developers to specify caveats, since they
don't have to know the exact format of the caveats.

## Examples

### Construction

```typescript
// To construct a permission controller, we first need to define the caveat
// types and restricted methods.

const caveatSpecifications = {
  filterArrayResponse: {
    type: 'filterArrayResponse',
    // If a permission has any caveats, its corresponding restricted method
    // implementation is decorated / wrapped with the implementations of its
    // caveats, using the caveat's decorator function.
    decorator:
      (
        // Restricted methods and other caveats can be async, so we have to
        // assume that the method is async.
        method: AsyncRestrictedMethod<RestrictedMethodParameters, Json>,
        caveat: FilterArrayCaveat,
      ) =>
      async (args: RestrictedMethodOptions<RestrictedMethodParameters>) => {
        const result = await method(args);
        if (!Array.isArray(result)) {
          throw Error('not an array');
        }

        return result.filter((resultValue) =>
          caveat.value.includes(resultValue),
        );
      },
  },
};

// The property names of this object must be target names.
const permissionSpecifications = {
  // This is a plain restricted method.
  wallet_getSecretArray: {
    // Every permission must have this field.
    permissionType: PermissionType.RestrictedMethod,
    // i.e., the restricted method name
    targetName: 'wallet_getSecretArray',
    allowedCaveats: ['filterArrayResponse'],
    // Every restricted method must specify its implementation in its
    // specification.
    methodImplementation: (
      _args: RestrictedMethodOptions<RestrictedMethodParameters>,
    ) => {
      return ['secret1', 'secret2', 'secret3'];
    },
  },

  // This is an endowment.
  secretEndowment: {
    permissionType: PermissionType.Endowment,
    // Naming conventions for endowments are yet to be established.
    targetName: 'endowment:globals',
    // This function will be called to retrieve the subject's endowment(s).
    // Here we imagine that these are the names of globals that will be made
    // available to a SES Compartment.
    endowmentGetter: (_options: EndowmentGetterParams) => [
      'fetch',
      'Math',
      'setTimeout',
    ],
  },
};

const permissionController = new PermissionController({
  caveatSpecifications,
  messenger: permissionControllerMessenger, // assume this was given
  permissionSpecifications,
  unrestrictedMethods: ['wallet_unrestrictedMethod'],
});
```

### Adding the permission middleware

```typescript
// This should take place where a middleware stack is created for a particular
// subject.

// The subject could be a port, stream, socket, etc.
const origin = getOrigin(subject);

const engine = new JsonRpcEngine();
engine.push(/* your various middleware*/);
engine.push(permissionController.createPermissionMiddleware({ origin }));
// Your middleware stack is now permissioned.
engine.push(/* your other various middleware*/);
```

### Calling a Restricted Method Internally

```typescript
// Sometimes, we need to call a restricted method internally, as a particular
// subject.
permissionController.executeRestrictedMethod(origin, 'wallet_getSecretArray');

// If the restricted method has any parameters, they are given as the third
// argument to executeRestrictedMethod().
permissionController.executeRestrictedMethod(origin, 'wallet_getSecret', {
  secretType: 'array',
});
```

### Getting Endowments

```typescript
// Getting endowments internally is the only option, since the host has to apply
// them in some way external to the permission system.
const endowments = await permissionController.getEndowments(
  origin,
  'endowment:globals',
);

// Now the endowments can be applied, whatever that means.
applyEndowments(origin, endowments);
```

### Requesting and getting permissions

```typescript
// From the perspective of subjects, requesting and getting permissions
// works the same as it does with `rpc-cap`.
const approvedPermissions = await ethereum.request({
  method: 'wallet_requestPermissions',
  params: [{
    wallet_getSecretArray: {},
  }]
})

const existingPermissions = await ethereum.request({
  method: 'wallet_getPermissions',
)
```

### Restricted method caveat decorators

Here follows some more example caveat decorator implementations.

```typescript
// Validation / passthrough
export function onlyArrayParams(
  method: AsyncRestrictedMethod<RestrictedMethodParameters, Json>,
  _caveat: Caveat<'PassthroughCaveat', never>,
) {
  return async (args: RestrictedMethodOptions<RestrictedMethodParameters>) => {
    if (!Array.isArray(args.params)) {
      throw new EthereumJsonRpcError();
    }

    return method(args);
  };
}

// "Return handler" example
export function eth_accounts(
  method: AsyncRestrictedMethod<RestrictedMethodParameters, Json>,
  caveat: Caveat<'RestrictAccountCaveat', string[]>,
) {
  return async (args: RestrictedMethodOptions<RestrictedMethodParameters>) => {
    const accounts: string[] | Json = await method(args);
    if (!Array.isArray(args.params)) {
      throw new EthereumJsonRpcError();
    }

    return (
      accounts.filter((account: string) => caveat.value.includes(account)) ?? []
    );
  };
}
```

[permissioncontroller]: https://github.com/MetaMask/core/tree/main/packages/permission-controller
[json-rpc]: ./json-rpc.md
