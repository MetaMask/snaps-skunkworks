import { SnapEndowments } from '@metamask/snaps-rpc-methods';

// These permissions are allowed without being on the allowlist.
export const ALLOWED_PERMISSIONS = Object.freeze([
  'snap_dialog',
  'snap_manageState',
  'snap_notify',
  'snap_getLocale',
  SnapEndowments.Cronjob,
  SnapEndowments.HomePage,
  SnapEndowments.LifecycleHooks,
  SnapEndowments.EthereumProvider,
  SnapEndowments.TransactionInsight,
  SnapEndowments.SignatureInsight,
]);

export const LEGACY_ENCRYPTION_KEY_DERIVATION_OPTIONS = {
  algorithm: 'PBKDF2' as const,
  params: {
    iterations: 10_000,
  },
};

export const PERMITTED_CHAINS_ENDOWMENT = 'endowment:permitted-chains';
