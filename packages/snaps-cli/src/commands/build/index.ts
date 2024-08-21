import type yargs from 'yargs';

import { buildHandler } from './build';
import builders from '../../builders';
import type { YargsArgs } from '../../types/yargs';

const command = {
  command: ['build', 'b'],
  desc: 'Build snap from source',
  builder: (yarg: yargs.Argv) => {
    yarg
      .option('dist', builders.dist)
      .option('eval', builders.eval)
      .option('manifest', builders.manifest)
      .option('outfileName', builders.outfileName)
      .option('sourceMaps', builders.sourceMaps)
      .option('src', builders.src)
      .option('stripComments', builders.stripComments)
      .option('transpilationMode', builders.transpilationMode)
      .option('depsToTranspile', builders.depsToTranspile)
      .option('writeManifest', builders.writeManifest)
      .implies('writeManifest', 'manifest')
      .implies('depsToTranspile', 'transpilationMode');
  },
  handler: async (argv: YargsArgs) => buildHandler(argv.context.config),
};

export * from './implementation';
export default command;
