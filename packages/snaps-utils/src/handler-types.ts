export enum HandlerType {
  OnRpcRequest = 'onRpcRequest',
  OnSignature = 'onSignature',
  OnTransaction = 'onTransaction',
  OnCronjob = 'onCronjob',
  OnInstall = 'onInstall',
  OnUpdate = 'onUpdate',
  OnNameLookup = 'onNameLookup',
  OnKeyringRequest = 'onKeyringRequest',
  OnHomePage = 'onHomePage',
  OnSettingsPage = 'onSettingsPage',
  OnUserInput = 'onUserInput',
  OnAssetsLookup = 'onAssetsLookup',
  OnAssetsConversion = 'onAssetsConversion',
  OnProtocolRequest = 'onProtocolRequest',
}

export type SnapHandler = {
  /**
   * The type of handler.
   */
  type: HandlerType;

  /**
   * Whether the handler is required, i.e., whether the request will fail if the
   * handler is called, but the snap does not export it.
   *
   * This is primarily used for the lifecycle handlers, which are optional.
   */
  required: boolean;

  /**
   * Validate the given snap export. This should return a type guard for the
   * handler type.
   *
   * @param snapExport - The export to validate.
   * @returns Whether the export is valid.
   */
  validator: (snapExport: unknown) => boolean;
};

export const SNAP_EXPORT_NAMES = Object.values(HandlerType);
