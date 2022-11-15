import { hasProperty } from '@metamask/utils';
import { promises as filesystem } from 'fs';
import path from 'path';
import { Arguments } from 'yargs';

export const permRequestKeys = [
  '@context',
  'id',
  'parentCapability',
  'invoker',
  'date',
  'caveats',
  'proof',
];

export const CONFIG_FILE = 'snap.config.js';

// CLI arguments whose values are file paths
const pathArguments = new Set([
  'src',
  's',
  'dist',
  'd',
  'bundle',
  'b',
  'root',
  'r',
]);

/**
 * Sets global variable snaps which tracks user settings:
 * watch mode activation, verbose errors messages, and whether to suppress
 * warnings.
 *
 * @param argv - Arguments as an object generated by `yargs`.
 */
export function setSnapGlobals(argv: Arguments) {
  if (['w', 'watch'].includes(argv._[0] as string)) {
    global.snaps.isWatching = true;
  } else {
    global.snaps.isWatching = false;
  }

  if (hasProperty(argv, 'verboseErrors')) {
    global.snaps.verboseErrors = booleanStringToBoolean(argv.verboseErrors);
  }

  if (hasProperty(argv, 'suppressWarnings')) {
    global.snaps.suppressWarnings = booleanStringToBoolean(
      argv.suppressWarnings,
    );
  }
}

/**
 * Attempts to convert a string to a boolean and throws if the value is invalid.
 *
 * @param value - The value to convert to a boolean.
 * @returns `true` if the value is the string `"true"`, `false` if it is the
 * string `"false"`, the value if it is already a boolean, or an error
 * otherwise.
 */
export function booleanStringToBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  } else if (value === 'true') {
    return true;
  } else if (value === 'false') {
    return false;
  }

  throw new Error(
    `Expected a boolean or the strings "true" or "false". Received: "${value}"`,
  );
}

/**
 * Sanitizes inputs. Currently normalizes "./" paths to ".".
 * Yargs handles other path normalization as specified in builders.
 *
 * @param argv - Arguments as an object generated by yargs.
 */
export function sanitizeInputs(argv: Arguments) {
  Object.keys(argv).forEach((key) => {
    if (typeof argv[key] === 'string') {
      // Node's path.normalize() does not do this
      if (argv[key] === './') {
        argv[key] = '.';
      }

      if (pathArguments.has(key)) {
        argv[key] = path.normalize(argv[key] as string);
      }
    }
  });
}

/**
 * Logs an error message to console. Logs original error if it exists and
 * the verboseErrors global is true.
 *
 * @param msg - The error message.
 * @param err - The original error.
 */
export function logError(msg: string | null, err?: Error): void {
  if (msg !== null) {
    console.error(msg);
  }

  if (err && global.snaps.verboseErrors) {
    console.error(err);
  }

  if (msg === null && (!err || (err && !global.snaps.verboseErrors))) {
    console.error('Unknown error.');
  }
}

/**
 * Logs a warning message to console.
 *
 * @param msg - The warning message.
 * @param error - The original error.
 */
export function logWarning(msg: string, error?: Error): void {
  if (msg && !global.snaps.suppressWarnings) {
    console.warn(msg);
    if (error && global.snaps.verboseErrors) {
      console.error(error);
    }
  }
}

/**
 * Logs an error, attempts to unlink the destination file, and kills the
 * process.
 *
 * @param prefix - The message prefix.
 * @param msg - The error message.
 * @param err - The original error.
 * @param destFilePath - The output file path.
 */
export async function writeError(
  prefix: string,
  msg: string,
  err: Error,
  destFilePath?: string,
): Promise<void> {
  let processedPrefix = prefix;
  if (!prefix.endsWith(' ')) {
    processedPrefix += ' ';
  }

  logError(processedPrefix + msg, err);
  try {
    if (destFilePath) {
      await filesystem.unlink(destFilePath);
    }
  } catch (unlinkError) {
    logError(`${processedPrefix}Failed to unlink mangled file.`, unlinkError);
  }

  // unless the watcher is active, exit
  if (!global.snaps.isWatching) {
    // TODO(ritave): Remove process exit and change into collapse of functions
    //               https://github.com/MetaMask/snaps-monorepo/issues/81
    process.exit(1);
  }
}

/**
 * Trims leading and trailing periods "." and forward slashes "/" from the
 * given path string.
 *
 * @param pathString - The path string to trim.
 * @returns The trimmed path string.
 */
export function trimPathString(pathString: string): string {
  return pathString.replace(/^[./]+|[./]+$/gu, '');
}
