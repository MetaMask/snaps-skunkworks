import { logInfo } from '@metamask/snaps-utils';
import type yargs from 'yargs';

import { initHandler } from './initHandler';
import builders from '../../builders';
import type { YargsArgs } from '../../types/yargs';

export const initCommand = {
  command: ['$0 [directory]'],
  desc: 'Initialize MetaMask Snaps project',
  builder: (yarg: yargs.Argv) => {
    yarg.positional('directory', builders.directory);
    return yarg;
  },
  handler: init,
};

/**
 * The main entrypoint for the init command. This calls the init handler to
 * initialize the snap package, builds the snap, and then updates the manifest
 * with the shasum of the built snap.
 *
 * @param argv - The Yargs arguments object.
 */
async function init(argv: YargsArgs): Promise<void> {
  await initHandler(argv);
  logInfo('\nSnap project successfully initiated!');
}
