import { serveHandler } from './serve';
import { getMockConfig } from '../../test-utils';
import * as webpack from '../../webpack';

jest.mock('../../webpack');

describe('serveHandler', () => {
  it('starts a server', async () => {
    const config = getMockConfig('webpack', {
      input: '/input.js',
      server: {
        root: '/foo',
        port: 1234,
      },
    });

    const listen = jest.fn().mockImplementation((port) => ({ port }));
    const log = jest.spyOn(console, 'log').mockImplementation();
    const getServer = jest
      .spyOn(webpack, 'getServer')
      .mockImplementation(() => ({
        listen,
      }));

    await serveHandler(config, {
      port: config.server.port,
    });

    expect(process.exitCode).not.toBe(1);
    expect(getServer).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(config.server.port);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:${config.server.port}.`,
      ),
    );
  });

  it('starts a server when using Browserify', async () => {
    const config = getMockConfig('browserify', {
      cliOptions: {
        root: '/foo/browserify',
        port: 4567,
      },
    });

    const listen = jest.fn().mockImplementation((port) => ({ port }));
    const log = jest.spyOn(console, 'log').mockImplementation();
    const getServer = jest
      .spyOn(webpack, 'getServer')
      .mockImplementation(() => ({
        listen,
      }));

    await serveHandler(config, {
      port: config.server.port,
    });

    expect(process.exitCode).not.toBe(1);
    expect(getServer).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(config.server.port);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:${config.server.port}.`,
      ),
    );
  });

  it('starts a server on the specified port', async () => {
    const config = getMockConfig('webpack', {
      input: '/input.js',
      server: {
        root: '/foo',
        port: 1234,
      },
    });

    const listen = jest.fn().mockImplementation((port) => ({ port }));
    const log = jest.spyOn(console, 'log').mockImplementation();
    const getServer = jest
      .spyOn(webpack, 'getServer')
      .mockImplementation(() => ({
        listen,
      }));

    await serveHandler(config, {
      port: 5678,
    });

    expect(process.exitCode).not.toBe(1);
    expect(getServer).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(5678);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:5678.`,
      ),
    );
  });
});
