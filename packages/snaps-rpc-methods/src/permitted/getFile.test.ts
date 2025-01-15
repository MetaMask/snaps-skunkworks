import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import type { GetFileParams } from '@metamask/snaps-sdk';
import { AuxiliaryFileEncoding } from '@metamask/snaps-sdk';
import { VirtualFile } from '@metamask/snaps-utils';
import type {
  JsonRpcRequest,
  PendingJsonRpcResponse,
  JsonRpcFailure,
  JsonRpcSuccess,
} from '@metamask/utils';
import { stringToBytes } from '@metamask/utils';

import type { GetFileHooks } from './getFile';
import { getFileHandler } from './getFile';

describe('snap_getFile', () => {
  describe('getFileHandler', () => {
    it('has the expected shape', () => {
      expect(getFileHandler).toMatchObject({
        methodNames: ['snap_getFile'],
        implementation: expect.any(Function),
        hookNames: {
          getSnapFile: true,
        },
      });
    });
  });

  describe('implementation', () => {
    const getMockHooks = () =>
      ({
        getSnapFile: jest.fn(),
      }) as GetFileHooks;

    it('returns the result received from the getSnapFile hook', async () => {
      const { implementation } = getFileHandler;

      const hooks = getMockHooks();

      const vfile = new VirtualFile(
        stringToBytes(JSON.stringify({ foo: 'bar' })),
      );
      const base64 = vfile.toString('base64');
      (
        hooks.getSnapFile as jest.MockedFunction<typeof hooks.getSnapFile>
      ).mockImplementation(async (_path: string) => base64);

      const engine = new JsonRpcEngine();
      engine.push((req, res, next, end) => {
        const result = implementation(
          req as JsonRpcRequest<GetFileParams>,
          res as PendingJsonRpcResponse<string>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_getFile',
        params: {
          path: './src/foo.json',
        },
      })) as JsonRpcSuccess<string>;

      expect(response.result).toBe(base64);
      expect(hooks.getSnapFile).toHaveBeenCalledWith(
        './src/foo.json',
        AuxiliaryFileEncoding.Base64,
      );
    });

    it('supports hex in encoding parameter', async () => {
      const { implementation } = getFileHandler;

      const hooks = getMockHooks();

      const vfile = new VirtualFile(
        stringToBytes(JSON.stringify({ foo: 'bar' })),
      );
      const hexadecimal = vfile.toString('hex');
      (
        hooks.getSnapFile as jest.MockedFunction<typeof hooks.getSnapFile>
      ).mockImplementation(async (_path: string) => hexadecimal);

      const engine = new JsonRpcEngine();
      engine.push((req, res, next, end) => {
        const result = implementation(
          req as JsonRpcRequest<GetFileParams>,
          res as PendingJsonRpcResponse<string>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_getFile',
        params: {
          path: './src/foo.json',
          encoding: 'hex',
        },
      })) as JsonRpcSuccess<string>;

      expect(response.result).toBe(hexadecimal);
      expect(hooks.getSnapFile).toHaveBeenCalledWith(
        './src/foo.json',
        AuxiliaryFileEncoding.Hex,
      );
    });

    it('ends with error if hook throws', async () => {
      const { implementation } = getFileHandler;

      const hooks = getMockHooks();

      (
        hooks.getSnapFile as jest.MockedFunction<typeof hooks.getSnapFile>
      ).mockImplementation(async (_path: string) => {
        throw new Error('foo bar');
      });

      const engine = new JsonRpcEngine();
      engine.push((req, res, next, end) => {
        const result = implementation(
          req as JsonRpcRequest<GetFileParams>,
          res as PendingJsonRpcResponse<string>,
          next,
          end,
          hooks,
        );

        result?.catch(end);
      });

      const response = (await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'snap_getFile',
        params: {
          path: './src/foo.json',
        },
      })) as JsonRpcFailure;

      expect(response.error).toStrictEqual({
        code: -32603,
        message: 'foo bar',
        data: {
          cause: {
            message: 'foo bar',
            stack: expect.any(String),
          },
        },
      });

      expect(hooks.getSnapFile).toHaveBeenCalledWith(
        './src/foo.json',
        AuxiliaryFileEncoding.Base64,
      );
    });
  });
});
