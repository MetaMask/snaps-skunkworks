Notes marked with ⚠️ are expanded below.
The columns are organized so that everything inside of the iframe is to the right of the iframe column

```mermaid

sequenceDiagram
  participant d as Dapp
  participant mm as MetaMask Background
  participant sc as Snap Controller
  participant ex as Execution Service
  participant i as Iframe
  participant exe as Execution Environment
  participant ses as SES Compartment
  participant s as A-Snap

  Note over d,mm: Invoke A-Snap with RPC request
  Note over d,mm: Permission for the dapp to invoke
  d->>mm: invokeSnap(snapId, request)
  Note over mm: Provider engine:<br>Permission to call handler check<br>Call matching handler

  mm->>sc: handleRequest

  Note over sc: > Snap is not running
  sc->>sc: startSnap(snapId, code)
  Note over sc: Permissions translated to actual endowments

  sc->>ex: executeSnap<br>(snapId, code, endowments)
  ex->>i: Create iframe
  i->exe: Load environment
  i-->>ex: _
  exe->>exe: Initialization
  ex->>ex: Set up streams and job
  Note over ex,exe: postMessage is set up<br>⚠️ e.source===_targetWindow
  Note over ex, exe: can use command(method, RPC) now
  ex->>exe: await command("ping", …)
  exe-->>ex: OK
  ex->>mm: setupSnapProvider(snapId, stream)
  Note over mm,ex: Communication is set up on the stream, <br>⚠️ checked for subjectType and snapId as origin
  mm-->>ex: _
  ex->>exe: await command("executeSnap", A-Snap code)
  exe->>exe: Create endowments, module etc.
  exe->>ses: Create Compartment
  exe->>exe: this.executeInSnapContext
  exe->>ses: evaluate(A-Snap code)
  ses->>s: Execute
  s-->>ses: Export RPC handler
  ses-->>exe: _
  exe->>exe: ⚠️ Validate and register exports
  exe-->>ex: OK
  ex->>ex: createSnapHooks
  Note over ex: Wires up snapRpc to the exported handler
  ex-->>sc: OK

  Note over sc: Remember: We received a request.<br>It can now be sent to snapRpc

  sc->>ex: handleRpcRequest
  Note over sc,ex: Request from dapp is wrapped in<br>another RPC for snap command
  sc->>sc: Set up timer
  ex->>exe: Handle RPC
  exe->s: Handle RPC
  s->>s: Do stuff

  Note over exe,s: Snap sends an RPC request through<br> the endowed API
  s->>exe: request
  exe->>exe: Check if method is wallet_* or snap_*
  Note over exe: Asserts defensively, doesn't use<br>method.startsWith
  exe->>mm: RPC request
  Note over mm: Provider engine:<br>Permission to call handler check<br>Call matching handler
  mm-->>exe: RPC response
  exe-->>s: RPC response

  s->>s: Do stuff
  
  s-->>exe: Snap response
  exe->>exe: Check if returned value is valid JSON
  
  exe-->>ex: Snap response
  ex->>ex: Throw if response is an error
  
  ex-->>sc: Snap response
  sc->>sc: Cancel timer

  sc-->>d: Snap response

```

## Notes

### RPC communication stringify for transport

All RPC requests are stringified in the process of passing them on, so no attacks based on poisoning methods of strings or objects should work after the request crosses the transport gap (e.g., postMessage).

### postMessage usage in iframe execution

IframeExecutionService sets targetOrigin to `*` and
WindowPostMessageStream says

```js
if(this._targetOrigin !== '*' ...)
```

So we're disabling the check if origin matches.
But then event.source is compared with this.\_targetWindow, which should do the trick.

- We could look into providing the right origin too.

### Snap RPC connection with provider

`subjectType` is being checked before a middleware gets to handle an RPC request. The snap is going through the same permission mechanism in the provider as a dapp would.

PermissionsController is fed the snapId as origin, but the snapId is coming from the reference passed in at the time of the communication channel being set up and before the snap ran. It's not reachable by the snap and could only ever be changed by a sloppy merge of content from the RPC request onto the object with the id. (which is not the case now)

TODO: add an e2e test checking if enforcing methods not allowed for a snap works.

createOriginMiddleware.js is always overriding the origin field when it passes it onto the `req` so it's not possible for a snap to put a fake origin in the request and have it be passed onto the permissions check. (getter/setter trickery won't work since the request has been serialized to string before reaching this place.)

### Snap exports

Export validation happens while exports references are being shallow-copied onto what we return as export from snaps, so it's not vulnerable to using a getter to bypass validations.
