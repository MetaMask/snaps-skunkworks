import type { SnapManifest } from '@metamask/snaps-utils';
import {
  logError,
  NpmSnapFileNames,
  readJsonFile,
} from '@metamask/snaps-utils/node';
import type { IncomingMessage, Server, ServerResponse } from 'http';
import { createServer } from 'http';
import type { AddressInfo } from 'net';
import { join, relative, resolve as resolvePath, sep, posix } from 'path';
import serveMiddleware from 'serve-handler';

import type { ProcessedConfig } from '../config';

/**
 * Get the relative path from one path to another.
 *
 * Note: This is a modified version of `path.relative` that uses Posix
 * separators for URL-compatibility.
 *
 * @param from - The path to start from.
 * @param to - The path to end at.
 * @returns The relative path.
 */
function getRelativePath(from: string, to: string) {
  return relative(from, to).split(sep).join(posix.sep);
}

/**
 * Get the allowed paths for the static server. This includes the output file,
 * the manifest file, and any auxiliary/localization files.
 *
 * @param config - The config object.
 * @param manifest - The Snap manifest object.
 * @returns An array of allowed paths.
 */
export function getAllowedPaths(
  config: ProcessedConfig,
  manifest: SnapManifest,
) {
  const auxiliaryFiles =
    manifest.source.files?.map((file) =>
      getRelativePath(
        config.server.root,
        resolvePath(config.server.root, file),
      ),
    ) ?? [];

  const localizationFiles =
    manifest.source.locales?.map((localization) =>
      getRelativePath(
        config.server.root,
        resolvePath(config.server.root, localization),
      ),
    ) ?? [];

  const otherFiles = manifest.source.location.npm.iconPath
    ? [
        getRelativePath(
          config.server.root,
          resolvePath(
            config.server.root,
            manifest.source.location.npm.iconPath,
          ),
        ),
      ]
    : [];

  return [
    getRelativePath(
      config.server.root,
      resolvePath(
        config.server.root,
        config.output.path,
        config.output.filename,
      ),
    ),
    getRelativePath(
      config.server.root,
      resolvePath(config.server.root, NpmSnapFileNames.Manifest),
    ),
    ...auxiliaryFiles,
    ...localizationFiles,
    ...otherFiles,
  ];
}

/**
 * Get a static server for development purposes.
 *
 * Note: We're intentionally not using `webpack-dev-server` here because it
 * adds a lot of extra stuff to the output that we don't need, and it's
 * difficult to customize.
 *
 * @param config - The config object.
 * @returns An object with a `listen` method that returns a promise that
 * resolves when the server is listening.
 */
export function getServer(config: ProcessedConfig) {
  /**
   * Get the response for a request. This is extracted into a function so that
   * we can easily catch errors and send a 500 response.
   *
   * @param request - The request.
   * @param response - The response.
   * @returns A promise that resolves when the response is sent.
   */
  async function getResponse(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    const manifestPath = join(config.server.root, NpmSnapFileNames.Manifest);
    const { result } = await readJsonFile<SnapManifest>(manifestPath);
    const allowedPaths = getAllowedPaths(config, result);

    const pathname =
      request.url &&
      request.headers.host &&
      new URL(request.url, `http://${request.headers.host}`).pathname;
    const path = pathname?.slice(1);
    const allowed = allowedPaths.some((allowedPath) => path === allowedPath);

    if (!allowed) {
      response.statusCode = 404;
      response.end();
      return;
    }

    await serveMiddleware(request, response, {
      public: config.server.root,
      directoryListing: false,
      headers: [
        {
          source: '**/*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-cache',
            },
            {
              key: 'Access-Control-Allow-Origin',
              value: '*',
            },
          ],
        },
      ],
    });
  }

  const server = createServer((request, response) => {
    getResponse(request, response).catch(
      /* istanbul ignore next */
      (error) => {
        logError(error);
        response.statusCode = 500;
        response.end();
      },
    );
  });

  /**
   * Start the server on the port specified in the config.
   *
   * @param port - The port to listen on.
   * @param host - The host to listen on.
   * @returns A promise that resolves when the server is listening. The promise
   * resolves to an object with the port and the server instance. Note that if
   * the `config.server.port` is `0`, the OS will choose a random port for us,
   * so we need to get the port from the server after it starts.
   */
  const listen = async (
    port = config.server.port,
    host = config.server.host,
  ) => {
    return new Promise<{
      port: number;
      host: string;
      server: Server;
      close: () => Promise<void>;
    }>((resolve, reject) => {
      try {
        server.listen(port, host, () => {
          const close = async () => {
            await new Promise<void>((resolveClose, rejectClose) => {
              server.close((closeError) => {
                if (closeError) {
                  return rejectClose(closeError);
                }

                return resolveClose();
              });
            });
          };

          const address = server.address() as AddressInfo;
          resolve({
            port: address.port,
            host: address.address,
            server,
            close,
          });
        });
      } catch (listenError) {
        reject(listenError);
      }
    });
  };

  return { listen };
}
