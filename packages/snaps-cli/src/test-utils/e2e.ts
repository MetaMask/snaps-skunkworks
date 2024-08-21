import { assert } from '@metamask/utils';
import type { ChildProcess } from 'child_process';
import { fork } from 'child_process';
import EventEmitter from 'events';
import { join } from 'path';

export const SNAP_DIR = join(__dirname, '../../../examples/packages/json-rpc');

export const SNAP_BROWSERIFY_DIR = join(
  __dirname,
  '../../../examples/packages/browserify',
);

/**
 * A test runner for running CLI commands.
 */
export class TestRunner extends EventEmitter {
  readonly #process: ChildProcess;

  readonly stdout: string[] = [];

  readonly stderr: string[] = [];

  #exitCode?: number | null = null;

  constructor(
    command: string,
    options: string[],
    workingDirectory: string = process.cwd(),
  ) {
    super();

    this.#process = fork(command, options, {
      cwd: workingDirectory,
      stdio: 'pipe',
    });

    this.#process.stdout?.on('data', (data) => {
      this.stdout.push(data.toString());
      this.emit('stdout', data.toString());
    });

    this.#process.stderr?.on('data', (data) => {
      this.stderr.push(data.toString());
      this.emit('stderr', data.toString());
    });

    this.#process.on('exit', (exitCode) => {
      this.#exitCode = exitCode;
      this.emit('exit', exitCode);
    });
  }

  /**
   * Whether the process is running.
   *
   * @returns `true` if the process is running, otherwise `false`.
   */
  get running() {
    return this.#exitCode === null;
  }

  /**
   * The exit code of the process.
   *
   * @returns The exit code of the process, or `undefined` if the process is
   * still running.
   */
  get exitCode() {
    return this.#exitCode;
  }

  /**
   * Kill the process. If the process is already dead, this does nothing.
   *
   * @param signal - The signal to send to the process.
   */
  kill(signal?: NodeJS.Signals) {
    if (!this.running) {
      return;
    }

    this.#process.kill(signal);
  }

  /**
   * Wait for the process to exit.
   *
   * @returns The exit code of the process.
   */
  async wait() {
    if (!this.running) {
      return this.#exitCode;
    }

    return new Promise<number | null>((resolve) => {
      this.#process.on('exit', (exitCode) => {
        resolve(exitCode);
      });
    });
  }

  /**
   * Wait for a message to be written to stdout.
   *
   * @param message - The message to wait for. If a string, the message must be
   * contained in the stdout. If a regular expression, the message must match
   * the stdout.
   * @returns The message that was written to stdout.
   */
  async waitForStdout(message?: string | RegExp) {
    assert(
      this.running,
      'Cannot wait for stdout while process is not running.',
    );

    return new Promise<string>((resolve) => {
      const listener = (actual: string) => {
        if (this.#matches(message, actual)) {
          this.off('stdout', listener);
          resolve(actual);
        }
      };

      this.on('stdout', listener);
    });
  }

  /**
   * Wait for a message to be written to stderr.
   *
   * @param message - The message to wait for. If a string, the message must be
   * contained in the stderr. If a regular expression, the message must match
   * the stderr.
   * @returns The message that was written to stderr.
   */
  async waitForStderr(message?: string | RegExp) {
    assert(
      this.running,
      'Cannot wait for stderr while process is not running.',
    );

    return new Promise<string>((resolve) => {
      const listener = (actual: string) => {
        if (this.#matches(message, actual)) {
          this.off('stderr', listener);
          resolve(actual);
        }
      };

      this.on('stderr', listener);
    });
  }

  /**
   * Check if `expected` matches `actual`.
   *
   * @param expected - The expected message.
   * @param actual - The actual message.
   * @returns `true` if `expected` matches `actual`, otherwise `false`.
   */
  #matches(expected: string | RegExp | undefined, actual: string) {
    if (expected === undefined) {
      return true;
    }

    if (typeof expected === 'string') {
      return actual.includes(expected);
    }

    return expected.test(actual);
  }
}

/**
 * Get a command runner.
 *
 * @param command - The `mm-snap` CLI command to run.
 * @param options - The options to pass to `mm-snap`.
 * @param workingDirectory - The working directory to run the command in.
 * @returns The test runner.
 */
export function getCommandRunner(
  command: string,
  options: string[] = [],
  workingDirectory: string = SNAP_DIR,
) {
  return new TestRunner(
    require.resolve('ts-node/dist/bin.js'),
    [
      '--require',
      'tsconfig-paths/register',
      '--files',
      '--swc',
      join(__dirname, '../main.ts'),
      command,
      ...options,
    ],
    workingDirectory,
  );
}
