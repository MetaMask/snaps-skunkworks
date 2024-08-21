import { DEFAULT_SNAP_BUNDLE } from '@metamask/snaps-utils/test-utils';
import fs from 'fs';

import { buildHandler } from './build';
import { build } from './implementation';
import { getMockConfig } from '../../test-utils';
import { evaluate } from '../eval';

jest.mock('fs');
jest.mock('../eval');
jest.mock('./implementation');

describe('buildHandler', () => {
  it('builds a snap', async () => {
    await fs.promises.writeFile('/input.js', DEFAULT_SNAP_BUNDLE);

    jest.spyOn(console, 'log').mockImplementation();
    const config = getMockConfig('webpack', {
      input: '/input.js',
      output: {
        path: '/foo',
        filename: 'output.js',
      },
    });

    await buildHandler(config);

    expect(process.exitCode).not.toBe(1);
    expect(build).toHaveBeenCalledWith(config, {
      evaluate: false,
      spinner: expect.any(Object),
    });

    expect(evaluate).toHaveBeenCalledWith(
      expect.stringMatching(/.*output\.js.*/u),
    );
  });

  it('does note evaluate if the evaluate option is set to false', async () => {
    await fs.promises.writeFile('/input.js', DEFAULT_SNAP_BUNDLE);

    jest.spyOn(console, 'log').mockImplementation();
    const config = getMockConfig('webpack', {
      input: '/input.js',
      output: {
        path: '/foo',
        filename: 'output.js',
      },
      evaluate: false,
    });

    await buildHandler(config);

    expect(process.exitCode).not.toBe(1);
    expect(build).toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('checks if the input file exists', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation();
    const config = getMockConfig('webpack', {
      input: 'fake-input-file.js',
    });

    await buildHandler(config);

    expect(process.exitCode).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(
        /Input file not found: ".+"\. Make sure that the "input" field in your snap config is correct\./u,
      ),
    );
  });
});
