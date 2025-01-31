import type yargs from 'yargs';

import builders from '../../builders';
import type { YargsArgs } from '../../types/yargs';
import { watchHandler } from './watch';

const command = {
  command: ['watch', 'w'],
  desc: 'Build Snap on change',
  builder: (yarg: yargs.Argv) => {
    yarg
      .option('src', builders.src)
      .option('eval', builders.eval)
      .option('dist', builders.dist)
      .option('outfileName', builders.outfileName)
      .option('sourceMaps', builders.sourceMaps)
      .option('stripComments', builders.stripComments)
      .option('transpilationMode', builders.transpilationMode)
      .option('depsToTranspile', builders.depsToTranspile)
      .option('manifest', builders.manifest)
      .option('writeManifest', builders.writeManifest)
      .option('serve', builders.serve)
      .option('root', builders.root)
      .option('port', builders.port)
      .option('host', builders.host)
      .implies('writeManifest', 'manifest')
      .implies('depsToTranspile', 'transpilationMode');
  },
  handler: async (argv: YargsArgs) =>
    watchHandler(argv.context.config, {
      port: argv.port,
      host: argv.host,
    }),
};

export * from './implementation';
export default command;
