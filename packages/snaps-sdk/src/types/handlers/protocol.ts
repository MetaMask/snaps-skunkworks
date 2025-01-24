import type {
  CaipChainId,
  Json,
  JsonRpcParams,
  JsonRpcRequest,
} from '@metamask/utils';

/**
 * The `onProtocolRequest` handler, which is called when a Snap receives a
 * protocol request.
 *
 * Note that using this handler requires the `endowment:protocol` permission.
 *
 * @param args - The request arguments.
 * @param args.origin - The origin of the request. This can be the ID of another
 * Snap, or the URL of a website.
 * @param args.scope - The scope of the request.
 * @param args.request - The protocol request sent to the Snap. This includes
 * the method name and parameters.
 * @returns The response to the protocol request. This must be a
 * JSON-serializable value. In order to return an error, throw a `SnapError`
 * instead.
 */
export type OnProtocolRequestHandler<
  Params extends JsonRpcParams = JsonRpcParams,
> = (args: {
  origin: string;
  scope: CaipChainId;
  request: JsonRpcRequest<Params>;
}) => Promise<Json>;
