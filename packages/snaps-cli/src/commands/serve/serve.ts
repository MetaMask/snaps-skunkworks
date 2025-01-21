import type { ProcessedConfig } from '../../config';
import { info } from '../../utils';
import { getServer } from '../../webpack';

type ServeOptions = {
  /**
   * The port to listen on.
   */
  port: number;
  host: string;
};

/**
 * Starts a local, static HTTP server on the given port with the given root
 * directory.
 *
 * @param config - The config object.
 * @param options - The options object.
 */
export async function serveHandler(
  config: ProcessedConfig,
  options: ServeOptions,
): Promise<void> {
  const server = getServer(config);

  // If the `configPort` is `0`, the OS will choose a random port for us, so we
  // need to get the port from the server after it starts.
  const { port, host } = await server.listen(options.port, options.host);

  info(`The server is listening on http://${host}:${port}.`);
}
