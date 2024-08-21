import { bytesToBase64 } from '@metamask/utils';
import { dim } from 'chalk';
import { promises as fs } from 'fs';
import { builtinModules } from 'module';
import type { Ora } from 'ora';
import { dirname, resolve } from 'path';
import stripAnsi from 'strip-ansi';
import type { Configuration } from 'webpack';

import { browserify, getFunctionLoader } from './loaders';
import type { ProcessedWebpackConfig } from '../config';

export const BROWSERSLIST_FILE = resolve(
  dirname(
    // eslint-disable-next-line n/no-extraneous-require
    require.resolve('@metamask/snaps-cli/package.json'),
  ),
  '.browserslistrc',
);

export const WEBPACK_FALLBACKS = {
  assert: require.resolve('assert/'),
  buffer: require.resolve('buffer/'),
  console: require.resolve('console-browserify'),
  constants: require.resolve('constants-browserify'),
  crypto: require.resolve('crypto-browserify'),
  domain: require.resolve('domain-browser'),
  events: require.resolve('events/'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  os: require.resolve('os-browserify/browser'),
  path: require.resolve('path-browserify'),
  punycode: require.resolve('punycode/'),
  process: require.resolve('process/browser'),
  querystring: require.resolve('querystring-es3'),
  stream: require.resolve('stream-browserify'),
  /* eslint-disable @typescript-eslint/naming-convention  */
  _stream_duplex: require.resolve('readable-stream/lib/_stream_duplex'),
  _stream_passthrough: require.resolve(
    'readable-stream/lib/_stream_passthrough',
  ),
  _stream_readable: require.resolve('readable-stream/lib/_stream_readable'),
  _stream_transform: require.resolve('readable-stream/lib/_stream_transform'),
  _stream_writable: require.resolve('readable-stream/lib/_stream_writable'),
  string_decoder: require.resolve('string_decoder/'),
  /* eslint-enable @typescript-eslint/naming-convention  */
  sys: require.resolve('util/'),
  timers: require.resolve('timers-browserify'),
  tty: require.resolve('tty-browserify'),
  url: require.resolve('url/'),
  util: require.resolve('util/'),
  vm: require.resolve('vm-browserify'),
  zlib: require.resolve('browserify-zlib'),
};

/**
 * Get the default loader for JavaScript and TypeScript files, based on the
 * config object.
 *
 * - If the `legacy` option is set, we use the custom `browserify` loader. This
 * uses the legacy Browserify config to transpile the code.
 * - Otherwise, we use the `swc-loader`. This is a Webpack loader that uses the
 * `SWC` compiler, which is a much faster alternative to Babel and TypeScript's
 * own compiler.
 *
 * @param config - The processed snap Webpack config.
 * @param config.legacy - The legacy config object, if any.
 * @param config.sourceMap - Whether to generate source maps.
 * @see https://swc.rs/docs/usage/swc-loader
 * @returns The default loader.
 */
export async function getDefaultLoader({
  legacy,
  sourceMap,
}: ProcessedWebpackConfig) {
  if (legacy) {
    /**
     * If the snap uses the legacy config, we use the custom `browserify`
     * loader. This uses the legacy Browserify config to transpile the code.
     * This is necessary for backwards compatibility with the
     * `bundlerCustomizer` function.
     */
    return getFunctionLoader(browserify, legacy);
  }

  const targets = await getBrowserslistTargets();
  return {
    /**
     * We use the `swc-loader` to transpile TypeScript and JavaScript files.
     * This is a Webpack loader that uses the `SWC` compiler, which is a much
     * faster alternative to Babel and TypeScript's own compiler.
     */
    loader: require.resolve('swc-loader'),

    /**
     * The options for the `swc-loader`. These can be overridden in the
     * `.swcrc` file.
     *
     * @see https://swc.rs/docs/configuration/swcrc
     */
    options: {
      sync: false,

      /**
       * This tells SWC to generate source maps. We set it to the
       * `sourceMap` value from the config object.
       *
       * This must be enabled if source maps are enabled in the config.
       */
      sourceMaps: Boolean(getDevTool(sourceMap)),

      jsc: {
        parser: {
          /**
           * This tells the parser to parse TypeScript files. If you
           * don't need to support TypeScript, you can set this to
           * `ecmascript` instead, but there's no harm in leaving it
           * as `typescript`.
           *
           * @see https://swc.rs/docs/configuration/compilation#jscparser
           */
          syntax: 'typescript',

          /**
           * This tells the parser to transpile JSX.
           *
           * @see https://swc.rs/docs/configuration/compilation#jscparser
           * @see https://swc.rs/docs/configuration/compilation#jscparserjsx
           */
          tsx: true,
        },

        transform: {
          react: {
            /**
             * This tells SWC to use the JSX runtime, instead of the
             * `createElement` function.
             *
             * @see https://swc.rs/docs/configuration/compilation#jsctransformreact
             */
            runtime: 'automatic',

            /**
             * This tells SWC to import the JSX runtime from the
             * `@metamask/snaps-sdk` package, instead of the default React
             * package.
             *
             * @see https://swc.rs/docs/configuration/compilation#jsctransformreact
             */
            importSource: '@metamask/snaps-sdk',

            /**
             * This tells SWC to use `Object.assign` and `Object.create` for
             * JSX spread attributes, instead of the default behavior.
             *
             * @see https://swc.rs/docs/configuration/compilation#jsctransformreact
             */
            useBuiltins: true,
          },
        },
      },

      /**
       * The module configuration. This tells SWC how to output the
       * transpiled code.
       *
       * @see https://swc.rs/docs/configuration/modules
       */
      module: {
        /**
         * This tells SWC to output ES6 modules. This will allow Webpack to
         * optimize the output code better. Snaps don't support ES6 however, so
         * the output code will be transpiled to CommonJS by Webpack later in
         * the build process.
         *
         * @see https://swc.rs/docs/configuration/modules#es6
         */
        type: 'es6',
      },

      env: {
        targets: targets.join(', '),
      },
    },
  };
}

/**
 * Get the Webpack devtool configuration based on the given snap config.
 *
 * - If `sourceMap` is `inline`, return `inline-source-map`.
 * - If `sourceMap` is `true`, return `source-map`.
 * - Otherwise, return `false`.
 *
 * @param sourceMap - The `sourceMap` value from the snap config.
 * @returns The Webpack devtool configuration.
 */
export function getDevTool(
  sourceMap: ProcessedWebpackConfig['sourceMap'],
): Configuration['devtool'] {
  if (sourceMap === 'inline') {
    return 'inline-source-map';
  }

  if (sourceMap === true) {
    return 'source-map';
  }

  return false;
}

/**
 * Get a function that can be used as handler function for Webpack's
 * `ProgressPlugin`.
 *
 * @param spinner - The spinner to update.
 * @param spinnerText - The initial spinner text. This will be prepended to the
 * percentage.
 * @returns A function that can be used as handler function for Webpack's
 * `ProgressPlugin`.
 */
// Note: This is extracted for testing purposes.
export function getProgressHandler(spinner?: Ora, spinnerText?: string) {
  return (percentage: number) => {
    if (spinner && spinnerText) {
      spinner.text = `${spinnerText} ${dim(
        `(${Math.round(percentage * 100)}%)`,
      )}`;
    }
  };
}

/**
 * Get the targets from the `.browserslistrc` file.
 *
 * @returns The browser targets as an array of strings.
 */
export async function getBrowserslistTargets() {
  const contents = await fs.readFile(BROWSERSLIST_FILE, 'utf8');
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Get a singular or plural string based on the given count. This is useful for
 * generating messages like "1 error" or "2 errors". By default, the plural
 * string is the singular string with an "s" appended to it.
 *
 * This assumes that the text is in English, and likely won't work for some
 * other languages.
 *
 * @param count - The count.
 * @param singular - The singular string.
 * @param plural - The plural string.
 * @returns The singular or plural string.
 * @example
 * ```typescript
 * pluralize(1, 'error'); // => 'error'
 * pluralize(2, 'error'); // => 'errors'
 * pluralize(1, 'error', 'problem'); // => 'error'
 * pluralize(2, 'error', 'problems'); // => 'problems'
 * ```
 */
export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return count === 1 ? singular : plural;
}

/**
 * Get an object that can be used as fallback config for Webpack's
 * `fallback` config.
 *
 * @param polyfills - The polyfill object from the snap config.
 * @returns The webpack fallback config.
 */
export function getFallbacks(polyfills: ProcessedWebpackConfig['polyfills']): {
  [index: string]: string | false;
} {
  if (polyfills === true) {
    return Object.fromEntries(
      builtinModules.map((name) => [
        name,
        WEBPACK_FALLBACKS[name as keyof typeof WEBPACK_FALLBACKS] ?? false,
      ]),
    );
  }

  if (polyfills === false) {
    return Object.fromEntries(builtinModules.map((name) => [name, false]));
  }

  return Object.fromEntries(
    builtinModules.map((name) => [
      name,
      polyfills[name as keyof ProcessedWebpackConfig['polyfills']]
        ? WEBPACK_FALLBACKS[name as keyof typeof WEBPACK_FALLBACKS]
        : false,
    ]),
  );
}

/**
 * Get an object that can be used as environment variables for Webpack's
 * `DefinePlugin`.
 *
 * @param environment - The environment object from the Snap config.
 * @param defaults - The default environment variables.
 * @returns The Webpack environment variables.
 */
export function getEnvironmentVariables(
  environment: Record<string, unknown>,
  defaults = {
    NODE_DEBUG: 'false',
    NODE_ENV: 'production',
    DEBUG: 'false',
  },
) {
  return Object.fromEntries(
    Object.entries({
      ...defaults,
      ...environment,
    }).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)]),
  );
}

/**
 * Format the given line to fit within the terminal width.
 *
 * @param line - The line to format.
 * @param indent - The indentation to use.
 * @param initialIndent - The initial indentation to use, i.e., the indentation
 * for the first line.
 * @returns The formatted line.
 */
function formatLine(line: string, indent: number, initialIndent: number) {
  const terminalWidth = process.stdout.columns;
  if (!terminalWidth) {
    return `${' '.repeat(initialIndent)}${line}`;
  }

  return line.split(' ').reduce(
    ({ formattedText, currentLineLength }, word, index) => {
      // `chalk` adds ANSI escape codes to the text, which are not visible
      // characters. We need to strip them to get the visible length of the
      // text.
      const visibleWord = stripAnsi(word);

      // Determine if a space should be added before the word.
      const spaceBeforeWord = index > 0 ? ' ' : '';
      const wordLengthWithSpace = visibleWord.length + spaceBeforeWord.length;

      // If the word would exceed the terminal width, start a new line.
      if (currentLineLength + wordLengthWithSpace > terminalWidth) {
        return {
          formattedText: `${formattedText}\n${' '.repeat(indent)}${word}`,
          currentLineLength: indent + visibleWord.length,
        };
      }

      // Otherwise, add the word to the current line.
      return {
        formattedText: formattedText + spaceBeforeWord + word,
        currentLineLength: currentLineLength + wordLengthWithSpace,
      };
    },
    {
      formattedText: ' '.repeat(initialIndent),
      currentLineLength: initialIndent,
    },
  ).formattedText;
}

/**
 * Format the given text to fit within the terminal width.
 *
 * @param text - The text to format.
 * @param indent - The indentation to use.
 * @param initialIndent - The initial indentation to use, i.e., the indentation
 * for the first line.
 * @returns The formatted text.
 */
export function formatText(
  text: string,
  indent: number,
  initialIndent = indent,
) {
  const lines = text.split('\n');

  // Apply formatting to each line separately and then join them.
  return lines
    .map((line, index) => {
      const lineIndent = index === 0 ? initialIndent : indent;
      return formatLine(line, indent, lineIndent);
    })
    .join('\n');
}

/**
 * Get an SVG from the given bytes and mime type.
 *
 * @param mimeType - The mime type of the image.
 * @param bytes - The image bytes.
 * @returns The SVG.
 */
export function getImageSVG(mimeType: string, bytes: Uint8Array) {
  const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg"><image href="${dataUrl}" /></svg>`;
}
