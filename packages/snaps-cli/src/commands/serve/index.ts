import type yargs from 'yargs';

import { serveHandler } from './serve';
import builders from '../../builders';
import type { YargsArgs } from '../../types/yargs';

const command = {
  command: ['serve', 's'],
  desc: 'Locally serve Snap file(s) for testing',
  builder: (yarg: yargs.Argv) => {
    yarg.option('root', builders.root).option('port', builders.port);
  },
  handler: async (argv: YargsArgs) =>
    serveHandler(argv.context.config, {
      port: argv.port ?? argv.context.config.server.port,
    }),
};

export default command;
