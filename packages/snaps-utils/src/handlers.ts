import type {
  OnAssetsConversionHandler,
  OnAssetsLookupHandler,
  OnCronjobHandler,
  OnHomePageHandler,
  OnInstallHandler,
  OnKeyringRequestHandler,
  OnNameLookupHandler,
  OnProtocolRequestHandler,
  OnRpcRequestHandler,
  OnSettingsPageHandler,
  OnSignatureHandler,
  OnTransactionHandler,
  OnUpdateHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { ComponentOrElementStruct, SeverityLevel } from '@metamask/snaps-sdk';
import {
  assign,
  literal,
  nullable,
  object,
  optional,
  string,
  array,
  size,
  union,
} from '@metamask/superstruct';

import type { SnapHandler } from './handler-types';
import { HandlerType } from './handler-types';

export type SnapRpcHookArgs = {
  origin: string;
  handler: HandlerType;
  request: Record<string, unknown>;
};

export const SNAP_EXPORTS = {
  [HandlerType.OnRpcRequest]: {
    type: HandlerType.OnRpcRequest,
    required: true,
    validator: (snapExport: unknown): snapExport is OnRpcRequestHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnTransaction]: {
    type: HandlerType.OnTransaction,
    required: true,
    validator: (snapExport: unknown): snapExport is OnTransactionHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnCronjob]: {
    type: HandlerType.OnCronjob,
    required: true,
    validator: (snapExport: unknown): snapExport is OnCronjobHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnNameLookup]: {
    type: HandlerType.OnNameLookup,
    required: true,
    validator: (snapExport: unknown): snapExport is OnNameLookupHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnInstall]: {
    type: HandlerType.OnInstall,
    required: false,
    validator: (snapExport: unknown): snapExport is OnInstallHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnUpdate]: {
    type: HandlerType.OnUpdate,
    required: false,
    validator: (snapExport: unknown): snapExport is OnUpdateHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnKeyringRequest]: {
    type: HandlerType.OnKeyringRequest,
    required: true,
    validator: (snapExport: unknown): snapExport is OnKeyringRequestHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnHomePage]: {
    type: HandlerType.OnHomePage,
    required: true,
    validator: (snapExport: unknown): snapExport is OnHomePageHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnSettingsPage]: {
    type: HandlerType.OnSettingsPage,
    required: true,
    validator: (snapExport: unknown): snapExport is OnSettingsPageHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnSignature]: {
    type: HandlerType.OnSignature,
    required: true,
    validator: (snapExport: unknown): snapExport is OnSignatureHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnUserInput]: {
    type: HandlerType.OnUserInput,
    required: false,
    validator: (snapExport: unknown): snapExport is OnUserInputHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnAssetsLookup]: {
    type: HandlerType.OnAssetsLookup,
    required: true,
    validator: (snapExport: unknown): snapExport is OnAssetsLookupHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnAssetsConversion]: {
    type: HandlerType.OnAssetsConversion,
    required: true,
    validator: (snapExport: unknown): snapExport is OnAssetsConversionHandler => {
      return typeof snapExport === 'function';
    },
  },
  [HandlerType.OnProtocolRequest]: {
    type: HandlerType.OnProtocolRequest,
    required: false,
    validator: (
      snapExport: unknown,
    ): snapExport is OnProtocolRequestHandler => {
      return typeof snapExport === 'function';
    },
  }
} as const;

export const OnTransactionSeverityResponseStruct = object({
  severity: optional(literal(SeverityLevel.Critical)),
});

export const OnTransactionResponseWithIdStruct = assign(
  OnTransactionSeverityResponseStruct,
  object({
    id: string(),
  }),
);

export const OnTransactionResponseWithContentStruct = assign(
  OnTransactionSeverityResponseStruct,
  object({
    content: ComponentOrElementStruct,
  }),
);

export const OnTransactionResponseStruct = nullable(
  union([
    OnTransactionResponseWithContentStruct,
    OnTransactionResponseWithIdStruct,
  ]),
);

export const OnSignatureResponseStruct = OnTransactionResponseStruct;

export const OnHomePageResponseWithContentStruct = object({
  content: ComponentOrElementStruct,
});

export const OnHomePageResponseWithIdStruct = object({
  id: string(),
});

export const OnHomePageResponseStruct = union([
  OnHomePageResponseWithContentStruct,
  OnHomePageResponseWithIdStruct,
]);

export const OnSettingsPageResponseStruct = OnHomePageResponseStruct;

export const AddressResolutionStruct = object({
  protocol: string(),
  resolvedDomain: string(),
});

export const DomainResolutionStruct = object({
  protocol: string(),
  resolvedAddress: string(),
  domainName: string(),
});

export const AddressResolutionResponseStruct = object({
  resolvedDomains: size(array(AddressResolutionStruct), 1, Infinity),
});

export const DomainResolutionResponseStruct = object({
  resolvedAddresses: size(array(DomainResolutionStruct), 1, Infinity),
});

export const OnNameLookupResponseStruct = nullable(
  union([AddressResolutionResponseStruct, DomainResolutionResponseStruct]),
);

/**
 * Utility type for getting the handler function type from a handler type.
 */
export type HandlerFunction<Type extends SnapHandler> =
  Type['validator'] extends (snapExport: unknown) => snapExport is infer Handler
    ? Handler
    : never;

/**
 * All the function-based handlers that a snap can implement.
 */
export type SnapFunctionExports = {
  [Key in keyof typeof SNAP_EXPORTS]?: HandlerFunction<
    (typeof SNAP_EXPORTS)[Key]
  >;
};

/**
 * All handlers that a snap can implement.
 */
export type SnapExports = SnapFunctionExports;
