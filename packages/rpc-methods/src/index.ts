export type { PermittedRpcMethodHooks } from './permitted';
export {
  handlers as permittedMethods,
  createSnapMethodMiddleware,
} from './permitted';
export * from './restricted';
export { SnapCaveatType } from '@metamask/snaps-utils';
export { selectHooks } from './utils';
export type { RequestFunction, SnapsGlobalObject } from './request';
