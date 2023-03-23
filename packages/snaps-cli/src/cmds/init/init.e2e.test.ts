import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { run } from '../../test-utils';

jest.unmock('fs');

const TMP_DIR = resolve(tmpdir(), 'metamask-snaps-test');

describe('mm-snap init', () => {
  it.each(['init', 'i'])(
    'initializes a new snap using "mm-snap %s"',
    async (command) => {
      const initPath = resolve(TMP_DIR, command);
      await fs.rm(initPath, { force: true, recursive: true });
      await fs.mkdir(TMP_DIR, { recursive: true });

      await run({
        command,
        options: [initPath],
      })
        .wait('stdout', `Preparing ${initPath}...`)
        .wait('stdout', 'Cloning template...')
        .wait('stdout', 'Installing dependencies...')
        .wait('stdout', 'Initializing git repository...')
        .wait(
          'stdout',
          "Build success: 'src/index.ts' bundled as 'dist/bundle.js'!",
        )
        .wait(
          'stdout',
          `Eval Success: evaluated '${join('dist', 'bundle.js')}' in SES!`,
        )
        .wait('stdout', 'Snap project successfully initiated!')
        .kill()
        .end();
    },
  );
});
