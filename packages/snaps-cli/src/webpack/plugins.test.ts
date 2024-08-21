import { createFsFromVolume, Volume } from 'memfs';
import ora from 'ora';
import { promisify } from 'util';
import type { Compiler, Watching } from 'webpack';
import { WebpackError, ProvidePlugin } from 'webpack';

import {
  SnapsBuiltInResolver,
  SnapsBundleWarningsPlugin,
  SnapsStatsPlugin,
  SnapsWatchPlugin,
} from './plugins';
import * as evalImplementation from '../commands/eval/implementation';
import { compile, getCompiler } from '../test-utils';

jest.dontMock('fs');
jest.mock('../commands/eval/implementation');

describe('SnapsStatsPlugin', () => {
  it('logs the compilation stats', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();

    await compile({
      config: {
        plugins: [new SnapsStatsPlugin()],
      },
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms\./u),
    );
  });

  it('logs any errors', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation();

    await expect(
      compile({
        code: `
        import { foo } from 'bar';
        console.log(foo);
      `,
        config: {
          plugins: [
            new SnapsStatsPlugin({
              verbose: false,
            }),
          ],
        },
      }),
    ).rejects.toThrow('Failed to compile.');

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 2 files in \d+ms with 1 error\./u),
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Module not found: Error: Can't resolve 'bar' in '/'",
      ),
    );

    expect(process.exitCode).toBe(1);
  });

  it('logs any warnings', async () => {
    const log = jest.spyOn(console, 'warn').mockImplementation();

    class AddWarningPlugin {
      apply(compiler: Compiler) {
        compiler.hooks.afterEmit.tap('AddWarningPlugin', (compilation) => {
          compilation.warnings.push(new WebpackError('This is a warning.'));
        });
      }
    }

    await compile({
      code: `
        console.log('foo');
      `,
      config: {
        plugins: [
          new AddWarningPlugin(),
          new SnapsStatsPlugin({
            verbose: false,
          }),
        ],
      },
    });

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms with 1 warning\./u),
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('This is a warning.'),
    );
  });

  it('logs stack traces when verbose is enabled', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation();

    await expect(
      compile({
        code: `
        import { foo } from 'bar';
        console.log(foo);
      `,
        config: {
          plugins: [
            new SnapsStatsPlugin({
              verbose: true,
            }),
          ],
        },
      }),
    ).rejects.toThrow('Failed to compile.');

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 2 files in \d+ms with 1 error\./u),
    );

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Module not found: Error: Can't resolve 'bar' in '/'",
      ),
    );

    expect(process.exitCode).toBe(1);
  });

  it('stops the spinner when in watch mode', async () => {
    jest.spyOn(console, 'log').mockImplementation();
    const spinner = ora();

    await compile({
      watchMode: true,
      config: {
        plugins: [
          new SnapsStatsPlugin(
            {
              verbose: false,
            },
            spinner,
          ),
        ],
      },
    });

    expect(spinner.succeed).toHaveBeenCalledWith(
      expect.stringContaining('Done!'),
    );
  });

  it('does not log if stats are not available', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();

    const plugin = new SnapsStatsPlugin();

    const tap = jest.fn();
    plugin.apply({
      hooks: {
        // @ts-expect-error - Partial mock.
        afterDone: {
          tap,
        },
      },
    });

    expect(tap).toHaveBeenCalled();
    const callback = tap.mock.calls[0][1];

    // eslint-disable-next-line n/callback-return
    await callback();
    expect(log).not.toHaveBeenCalled();
  });
});

describe('SnapsWatchPlugin', () => {
  it('logs a message when changes are detected', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();

    const fileSystem = createFsFromVolume(new Volume());
    const compiler = await getCompiler({
      fileSystem,
      config: {
        plugins: [
          new SnapsWatchPlugin({
            files: [],
          }),
        ],
      },
    });

    // Wait for the initial compilation to complete.
    const watcher = await new Promise<Watching>((resolve) => {
      const innerWatcher = compiler.watch(
        {
          poll: 1,
          ignored: ['/output.js'],
        },
        () => {
          resolve(innerWatcher);
        },
      );
    });

    expect(log).not.toHaveBeenCalled();

    // Trigger a change.
    const invalidate = promisify(watcher.invalidate.bind(watcher));
    await invalidate();

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Changes detected in .*, recompiling\./u),
    );

    const close = promisify(watcher.close.bind(watcher));
    await close();
  });

  it('adds the files to the compiler file dependencies', async () => {
    jest.spyOn(console, 'log').mockImplementation();

    const fileSystem = createFsFromVolume(new Volume());
    const compiler = await getCompiler({
      fileSystem,
      config: {
        plugins: [
          new SnapsWatchPlugin({
            files: ['/snap.manifest.json'],
          }),
        ],
      },
    });

    const promise = new Promise<void>((resolve) => {
      compiler.hooks.afterEmit.tap('Jest', (compilation) => {
        expect(compilation.fileDependencies.has('/snap.manifest.json')).toBe(
          true,
        );

        resolve();
      });
    });

    // Wait for the initial compilation to complete.
    const watcher = await new Promise<Watching>((resolve) => {
      const innerWatcher = compiler.watch(
        {
          poll: 1,
          ignored: ['/output.js'],
        },
        () => {
          resolve(innerWatcher);
        },
      );
    });

    const invalidate = promisify(watcher.invalidate.bind(watcher));
    await invalidate();

    await promise;

    const close = promisify(watcher.close.bind(watcher));
    await close();
  });

  it('evaluates the bundle if enabled', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const evaluate = jest
      .spyOn(evalImplementation, 'evaluate')
      .mockImplementation();

    const fileSystem = createFsFromVolume(new Volume());
    const compiler = await getCompiler({
      fileSystem,
      config: {
        plugins: [
          new SnapsWatchPlugin({
            bundle: '/output.js',
            evaluate: true,
            files: [],
          }),
        ],
      },
    });

    // Wait for the initial compilation to complete.
    const watcher = await new Promise<Watching>((resolve) => {
      const innerWatcher = compiler.watch(
        {
          poll: 1,
          ignored: ['/output.js'],
        },
        () => {
          resolve(innerWatcher);
        },
      );
    });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/Snap bundle evaluated successfully\./u),
    );
    expect(evaluate).toHaveBeenCalled();

    const close = promisify(watcher.close.bind(watcher));
    await close();
  });

  it('logs evaluation errors', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation();
    const error = jest.spyOn(console, 'error').mockImplementation();
    const evaluate = jest
      .spyOn(evalImplementation, 'evaluate')
      .mockRejectedValue(new Error('Evaluation error.'));

    const fileSystem = createFsFromVolume(new Volume());
    const compiler = await getCompiler({
      fileSystem,
      config: {
        plugins: [
          new SnapsWatchPlugin({
            bundle: '/output.js',
            evaluate: true,
            files: [],
          }),
        ],
      },
    });

    // Wait for the initial compilation to complete.
    const watcher = await new Promise<Watching>((resolve) => {
      const innerWatcher = compiler.watch(
        {
          poll: 1,
          ignored: ['/output.js'],
        },
        () => {
          resolve(innerWatcher);
        },
      );
    });

    expect(log).not.toHaveBeenCalled();
    expect(evaluate).toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('Evaluation error.'),
    );

    const close = promisify(watcher.close.bind(watcher));
    await close();
  });
});

describe('SnapsBuiltInResolver', () => {
  it('adds unresolved built-in modules to a set', async () => {
    const plugin = new SnapsBuiltInResolver();

    await compile({
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        resolve: {
          fallback: {
            fs: false,
            path: false,
          },
          plugins: [plugin],
        },
      },
    });

    expect(plugin.unresolvedModules).toStrictEqual(new Set(['fs', 'path']));
  });

  it('does not add resolved built-in modules to a set', async () => {
    const plugin = new SnapsBuiltInResolver();
    const fileSystem = createFsFromVolume(new Volume());

    await fileSystem.promises.writeFile('/fs.js', 'module.exports = {}');

    await compile({
      fileSystem,
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        resolve: {
          fallback: {
            fs: '/fs.js',
            path: false,
          },
          plugins: [plugin],
        },
      },
    });

    expect(plugin.unresolvedModules).toStrictEqual(new Set(['path']));
  });

  it('does not add ignored built-in modules to a set', async () => {
    const plugin = new SnapsBuiltInResolver({
      ignore: ['fs', 'path'],
    });

    await compile({
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        resolve: {
          fallback: {
            fs: false,
            path: false,
          },
          plugins: [plugin],
        },
      },
    });

    expect(plugin.unresolvedModules).toStrictEqual(new Set());
  });
});

describe('SnapsBundleWarningsPlugin', () => {
  it('adds a warning when built-in modules are unresolved', async () => {
    const builtInResolver = new SnapsBuiltInResolver();

    builtInResolver.unresolvedModules.add('fs');
    builtInResolver.unresolvedModules.add('path');

    const { stats } = await compile({
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        plugins: [
          new SnapsBundleWarningsPlugin({ builtIns: true, builtInResolver }),
        ],
        resolve: {
          fallback: {
            fs: false,
            path: false,
          },
        },
      },
    });

    expect(stats.warnings).toHaveLength(1);
    expect(stats.warnings?.[0].message).toMatch(
      /The snap attempted to use one or more Node.js builtins, but no browser fallback has been provided\./u,
    );
    expect(stats.warnings?.[0].details).toContain('fs');
    expect(stats.warnings?.[0].details).toContain('path');
  });

  it('does not add a warning when built-in modules are resolved', async () => {
    const builtInResolver = new SnapsBuiltInResolver();

    const { stats } = await compile({
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        plugins: [
          new SnapsBundleWarningsPlugin({ builtIns: true, builtInResolver }),
        ],
        resolve: {
          fallback: {
            // These are technically not resolved, but for this test, we just
            // don't add them to the unresolved set.
            fs: false,
            path: false,
          },
        },
      },
    });

    expect(stats.warnings).toHaveLength(0);
  });

  it('does add a warning when there is no resolver plugin', async () => {
    const { stats } = await compile({
      code: `
        import fs from 'fs';
        import path from 'path';

        console.log(fs, path);
      `,
      config: {
        plugins: [
          new SnapsBundleWarningsPlugin({
            builtIns: true,
            builtInResolver: undefined,
          }),
        ],
        resolve: {
          fallback: {
            // These are technically not resolved, but for this test, we just
            // don't add them to the unresolved set.
            fs: false,
            path: false,
          },
        },
      },
    });

    expect(stats.warnings).toHaveLength(0);
  });

  it('adds a warning when the bundle contains Buffer', async () => {
    const { stats } = await compile({
      code: `
        console.log(Buffer);
      `,
      config: {
        plugins: [new SnapsBundleWarningsPlugin()],
      },
    });

    expect(stats.warnings).toHaveLength(1);
    expect(stats.warnings?.[0].message).toMatch(
      /The snap attempted to use the Node\.js Buffer global, which is not supported in the MetaMask Snaps CLI by default\./u,
    );
  });

  it('does add a warning when the buffer option is disabled', async () => {
    const { stats } = await compile({
      code: `
        console.log(Buffer);
      `,
      config: {
        plugins: [new SnapsBundleWarningsPlugin({ buffer: false })],
      },
    });

    expect(stats.warnings).toHaveLength(0);
  });

  it('does add a warning when the bundle does not contain Buffer', async () => {
    const { stats } = await compile({
      code: `
        console.log('Hello, world!');
      `,
      config: {
        plugins: [new SnapsBundleWarningsPlugin()],
      },
    });

    expect(stats.warnings).toHaveLength(0);
  });

  it('does not log a message when Buffer is provided', async () => {
    const { stats } = await compile({
      code: `
        console.log(Buffer);
      `,
      config: {
        plugins: [
          new ProvidePlugin({
            Buffer: ['./input.js'],
          }),
          new SnapsBundleWarningsPlugin(),
        ],
      },
    });

    expect(stats.warnings).toHaveLength(0);
  });
});
