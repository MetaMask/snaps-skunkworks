import type { PermissionConstraint } from '@metamask/permission-controller';
import { SnapEndowments } from '@metamask/snaps-rpc-methods';
import { SnapCaveatType } from '@metamask/snaps-utils';
import { MOCK_SNAP_ID } from '@metamask/snaps-utils/test-utils';
import type { CaipAccountId, CaipChainId } from '@metamask/utils';

export const BTC_CAIP2 =
  'bip122:000000000019d6689c085ae165831e93' as CaipChainId;
export const BTC_CONNECTED_ACCOUNTS = [
  'bip122:000000000019d6689c085ae165831e93:128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6',
] as CaipAccountId[];

export const MOCK_BTC_ACCOUNTS = [
  {
    address: '128Lkh3S7CkDTBZ8W7BbpsN3YYizJMp8p6',
    id: '408eb023-8678-4b53-8885-f1e50b8b5bc3',
    metadata: {
      importTime: 1729154128900,
      keyring: { type: 'Snap Keyring' },
      lastSelected: 1729154128902,
      name: 'Bitcoin Account',
      snap: {
        enabled: true,
        id: MOCK_SNAP_ID,
        name: 'Bitcoin',
      },
    },
    methods: ['btc_sendmany'],
    options: { index: 0, scope: BTC_CAIP2 },
    type: 'bip122:p2wpkh',
  },
];

export const SOLANA_CAIP2 =
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as CaipChainId;
export const SOLANA_CONNECTED_ACCOUNTS = [
  `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv`,
] as CaipAccountId[];

export const MOCK_SOLANA_ACCOUNTS = [
  {
    address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv',
    id: '408eb023-8678-4b53-8885-f1e50b8b5bc3',
    metadata: {
      importTime: 1729154128900,
      keyring: { type: 'Snap Keyring' },
      lastSelected: 1729154128902,
      name: 'Solana Account',
      snap: {
        enabled: true,
        id: MOCK_SNAP_ID,
        name: 'Solana',
      },
    },
    methods: ['signAndSendTransaction'],
    options: { index: 0, scope: SOLANA_CAIP2 },
    type: 'solana:data-account',
  },
];

export const MOCK_SOLANA_SNAP_PERMISSIONS: Record<
  string,
  PermissionConstraint
> = {
  [SnapEndowments.Keyring]: {
    caveats: [
      {
        type: SnapCaveatType.KeyringOrigin,
        value: { allowedOrigins: [] },
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.Keyring,
  },
  [SnapEndowments.Protocol]: {
    caveats: [
      {
        type: SnapCaveatType.ProtocolSnapScopes,
        value: { [SOLANA_CAIP2]: { methods: ['getVersion'] } },
      },
    ],
    date: 1664187844588,
    id: 'izn0WGUO8cvq_jqvLQuQP',
    invoker: MOCK_SNAP_ID,
    parentCapability: SnapEndowments.Protocol,
  },
};
