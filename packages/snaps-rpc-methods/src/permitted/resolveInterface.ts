import type { JsonRpcEngineEndCallback } from '@metamask/json-rpc-engine';
import type { PermittedHandlerExport } from '@metamask/permission-controller';
import { rpcErrors } from '@metamask/rpc-errors';
import type {
  JsonRpcRequest,
  ResolveInterfaceParams,
  ResolveInterfaceResult,
} from '@metamask/snaps-sdk';
import type { InferMatching } from '@metamask/snaps-utils';
import { StructError, create, object, string } from '@metamask/superstruct';
import { JsonStruct } from '@metamask/utils';
import type { PendingJsonRpcResponse, type Json } from '@metamask/utils';

import type { MethodHooksObject } from '../utils';

const hookNames: MethodHooksObject<ResolveInterfaceMethodHooks> = {
  resolveInterface: true,
};

export type ResolveInterfaceMethodHooks = {
  /**
   * @param id - The interface id.
   * @param value - The value to resolve the interface with.
   */
  resolveInterface: (id: string, value: Json) => Promise<void>;
};

export const resolveInterfaceHandler: PermittedHandlerExport<
  ResolveInterfaceMethodHooks,
  ResolveInterfaceParameters,
  ResolveInterfaceResult
> = {
  methodNames: ['snap_resolveInterface'],
  implementation: getResolveInterfaceImplementation,
  hookNames,
};

const ResolveInterfaceParametersStruct = object({
  id: string(),
  value: JsonStruct,
});

export type ResolveInterfaceParameters = InferMatching<
  typeof ResolveInterfaceParametersStruct,
  ResolveInterfaceParams
>;

/**
 * The `snap_resolveInterface` method implementation.
 *
 * @param req - The JSON-RPC request object.
 * @param res - The JSON-RPC response object.
 * @param _next - The `json-rpc-engine` "next" callback. Not used by this
 * function.
 * @param end - The `json-rpc-engine` "end" callback.
 * @param hooks - The RPC method hooks.
 * @param hooks.resolveInterface - The function to resolve the interface.
 * @returns Nothing.
 */
async function getResolveInterfaceImplementation(
  req: JsonRpcRequest<ResolveInterfaceParameters>,
  res: PendingJsonRpcResponse<ResolveInterfaceResult>,
  _next: unknown,
  end: JsonRpcEngineEndCallback,
  { resolveInterface }: ResolveInterfaceMethodHooks,
): Promise<void> {
  const { params } = req;

  try {
    const validatedParams = getValidatedParams(params);

    const { id, value } = validatedParams;

    await resolveInterface(id, value);
    res.result = null;
  } catch (error) {
    return end(error);
  }

  return end();
}

/**
 * Validate the resolveInterface method `params` and returns them cast to the correct
 * type. Throws if validation fails.
 *
 * @param params - The unvalidated params object from the method request.
 * @returns The validated resolveInterface method parameter object.
 */
function getValidatedParams(params: unknown): ResolveInterfaceParameters {
  try {
    return create(params, ResolveInterfaceParametersStruct);
  } catch (error) {
    if (error instanceof StructError) {
      throw rpcErrors.invalidParams({
        message: `Invalid params: ${error.message}.`,
      });
    }
    /* istanbul ignore next */
    throw rpcErrors.internal();
  }
}
