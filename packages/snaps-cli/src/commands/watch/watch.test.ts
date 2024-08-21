import { getMockConfig } from '@metamask/snaps-cli/test-utils';
import { DEFAULT_SNAP_BUNDLE } from '@metamask/snaps-utils/test-utils';
import fs from 'fs';

import { watch } from './implementation';
import { watchHandler } from './watch';
import * as webpack from '../../webpack';

jest.mock('fs');
jest.mock('../../webpack');
jest.mock('./implementation');

describe('watchHandler', () => {
  it('builds the snap and watches for changes', async () => {
    await fs.promises.writeFile('/input.js', DEFAULT_SNAP_BUNDLE);

    const config = getMockConfig('webpack', {
      input: '/input.js',
      output: {
        path: '/foo',
        filename: 'output.js',
      },
    });

    const listen = jest.fn().mockReturnValue({ port: config.server.port });
    const log = jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(webpack, 'getServer').mockImplementation(() => ({
      listen,
    }));

    await watchHandler(config, {});

    expect(process.exitCode).not.toBe(1);
    expect(listen).toHaveBeenCalledWith(config.server.port);
    expect(watch).toHaveBeenCalledWith(config, {
      spinner: expect.any(Object),
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:${config.server.port}.`,
      ),
    );
  });

  it('checks if the input file exists', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation();
    const config = getMockConfig('webpack', {
      input: 'fake-input-file.js',
    });

    await watchHandler(config, {});

    expect(process.exitCode).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /Input file not found: ".*"\. Make sure that the "input" field in your snap config is correct\./u,
      ),
    );
  });

  it('serves the bundle on the specified port', async () => {
    await fs.promises.writeFile('/input.js', DEFAULT_SNAP_BUNDLE);

    const listen = jest.fn().mockImplementation((port) => ({ port }));
    const log = jest.spyOn(console, 'log').mockImplementation();
    const getServer = jest
      .spyOn(webpack, 'getServer')
      .mockImplementation(() => ({
        listen,
      }));

    const config = getMockConfig('webpack', {
      input: '/input.js',
      output: {
        path: '/foo',
        filename: 'output.js',
      },
    });

    await watchHandler(config, {
      port: 1000,
    });

    expect(getServer).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(1000);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:1000.`,
      ),
    );
  });

  it('does not serve when the server is disabled', async () => {
    await fs.promises.writeFile('/input.js', DEFAULT_SNAP_BUNDLE);

    const listen = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation();
    const getServer = jest
      .spyOn(webpack, 'getServer')
      .mockImplementation(() => ({
        listen,
      }));

    const config = getMockConfig('webpack', {
      input: '/input.js',
      output: {
        path: '/foo',
        filename: 'output.js',
      },
      server: {
        enabled: false,
      },
    });

    await watchHandler(config, {
      port: 1000,
    });

    expect(getServer).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalledWith();

    expect(log).not.toHaveBeenCalledWith(
      expect.stringContaining(
        `The server is listening on http://localhost:1000.`,
      ),
    );
  });
});
