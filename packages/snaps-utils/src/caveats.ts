export enum SnapCaveatType {
  /**
   * Permitted derivation paths, used by `snap_getBip32Entropy`.
   */
  PermittedDerivationPaths = 'permittedDerivationPaths',

  /**
   * Permitted coin types, used by `snap_getBip44Entropy`.
   */
  PermittedCoinTypes = 'permittedCoinTypes',

  /**
   * Caveat specifying a snap cronjob.
   */
  SnapCronjob = 'snapCronjob',

  /**
   * Caveat specifying access to the transaction origin, used by `endowment:transaction-insight`.
   */
  TransactionOrigin = 'transactionOrigin',

  /**
   * Caveat specifying access to the signature origin, used by `endowment:signature-insight`.
   */
  SignatureOrigin = 'signatureOrigin',

  /**
   * The origins that a Snap can receive JSON-RPC messages from.
   */
  RpcOrigin = 'rpcOrigin',

  /**
   * The origins that a Snap can receive keyring messages from.
   */
  KeyringOrigin = 'keyringOrigin',

  /**
   * Caveat specifying the snap IDs that can be interacted with.
   */
  SnapIds = 'snapIds',

  /**
   * Caveat specifying the CAIP-2 chain IDs that a snap can service, currently limited to `endowment:name-lookup`.
   */
  ChainIds = 'chainIds',

  /**
   * Caveat specifying the input that a name lookup snap can service, currently limited to `endowment:name-lookup`.
   */
  LookupMatchers = 'lookupMatchers',

  /**
   * Caveat specifying the max request time for a handler endowment.
   */
  MaxRequestTime = 'maxRequestTime',

  /**
   * Caveat specifying a list of RPC methods serviced by an endowment.
   */
  ProtocolSnapChains = 'protocolSnapChains',
}
