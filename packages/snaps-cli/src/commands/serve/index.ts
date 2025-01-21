import type yargs from 'yargs';

import builders from '../../builders';
import type { YargsArgs } from '../../types/yargs';
import { serveHandler } from './serve';

const command = {
  command: ['serve', 's'],
  desc: 'Locally serve Snap file(s) for testing',
  builder: (yarg: yargs.Argv) => {
    yarg
      .option('root', builders.root)
      .option('port', builders.port)
      .option('host', builders.host);
  },
  handler: async (argv: YargsArgs) =>
    serveHandler(argv.context.config, {
      port: argv.port ?? argv.context.config.server.port,
      host: argv.host ?? argv.context.config.server.host,
    }),
};

export default command;
