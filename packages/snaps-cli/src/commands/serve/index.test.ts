import command from '.';
import { serveHandler } from './serve';
import { getMockConfig } from '../../test-utils';
import type { YargsArgs } from '../../types/yargs';

jest.mock('./serve');

const getMockArgv = () => {
  return {
    context: { config: getMockConfig('webpack') },
  } as unknown as YargsArgs;
};

describe('serve command', () => {
  it('calls the `serveHandler` function', async () => {
    await command.handler(getMockArgv());
    expect(serveHandler).toHaveBeenCalled();
  });
});
