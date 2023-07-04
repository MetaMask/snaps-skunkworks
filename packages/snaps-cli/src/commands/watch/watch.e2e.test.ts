import { promises as fs } from 'fs';
import { resolve } from 'path';

import { getCommandRunner, SNAP_DIR } from '../../test-utils';

describe('mm-snap watch', () => {
  const SNAP_FILE = resolve(SNAP_DIR, 'src/index.ts');
  let originalFile: string;

  beforeEach(async () => {
    // Since this is an end-to-end test, and we're working with a "real" snap,
    // we have to make a copy of the original snap file, so we can modify it
    // and reset it after the test.
    originalFile = await fs.readFile(SNAP_FILE, 'utf-8');
  });

  afterEach(async () => {
    await fs.writeFile(SNAP_FILE, originalFile);
  });

  it.each(['watch', 'w'])(
    'builds and watches for changes using "mm-snap %s"',
    async (command) => {
      const runner = getCommandRunner(command, ['--port', '8123']);
      await runner.waitForStdout(/Compiled \d+ files in \d+ms\./u);

      expect(runner.stderr).toStrictEqual([]);
      expect(runner.stdout[0]).toMatch(/Checking the input file\./u);
      expect(runner.stdout[1]).toMatch(/Starting the development server\./u);
      expect(runner.stdout[2]).toMatch(
        /The server is listening on http:\/\/localhost:8123\./u,
      );
      expect(runner.stdout[3]).toMatch(/Building the snap bundle\./u);
      expect(runner.stdout[4]).toMatch(/Compiled \d+ files in \d+ms\./u);

      const promise = runner.waitForStdout(/Compiled \d+ files in \d+ms\./u);
      await fs.writeFile(SNAP_FILE, 'console.log("Hello, world!");');
      await promise;

      expect(runner.stdout).toContainEqual(
        expect.stringMatching(/Changes detected in .*, recompiling\./u),
      );

      runner.kill();
    },
  );
});
