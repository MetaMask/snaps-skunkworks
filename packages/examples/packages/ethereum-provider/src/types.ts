import type { Hex } from '@metamask/utils';

export type BaseParams = {
  chainId?: Hex;
};

export type PersonalSignParams = BaseParams & {
  message: string;
};

export type SignTypedDataParams = {
  message: string;
};
