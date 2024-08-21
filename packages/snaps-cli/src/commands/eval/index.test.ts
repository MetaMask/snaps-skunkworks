import command from '.';
import { evaluateHandler } from './eval';
import { getMockConfig } from '../../test-utils';
import type { YargsArgs } from '../../types/yargs';

jest.mock('./eval');

const getMockArgv = ({ bundle = 'dist/snap.js' } = {}) => {
  return {
    context: { config: getMockConfig('webpack') },
    bundle,
  } as unknown as YargsArgs;
};

describe('eval command', () => {
  it('calls the `evaluateHandler` function', async () => {
    await command.handler(getMockArgv());
    expect(evaluateHandler).toHaveBeenCalled();
  });
});
