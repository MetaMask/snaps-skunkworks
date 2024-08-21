import type { LoaderDefinitionFunction } from 'webpack';

/**
 * Options for the function loader.
 */
export type FunctionLoaderOptions = {
  /**
   * The function to execute. This is bound to the loader context, so it can
   * access the loader options and other properties.
   */
  fn: LoaderDefinitionFunction;
};

/**
 * A loader that executes a function. See {@link getFunctionLoader} for more
 * information.
 *
 * @param content - The input file contents as a `Uint8Array`.
 * @returns The output of the function.
 */
const loader: LoaderDefinitionFunction<FunctionLoaderOptions> = async function (
  content,
) {
  const { fn } = this.getOptions();
  return fn.bind(this)(content);
};

export default loader;

/**
 * Get a loader that executes the given function. This is useful for executing
 * loaders without needing to pass a file to Webpack.
 *
 * @param fn - The function to execute.
 * @param options - The options to pass to the loader.
 * @returns The loader definition.
 */
export function getFunctionLoader<Options>(
  fn: LoaderDefinitionFunction<Options>,
  options: Options,
) {
  return {
    // We use `__filename` as the loader, so Webpack will execute the loader in
    // this file, with the actual function in the options.
    loader: __filename,
    options: {
      fn,
      ...options,
    },
  };
}

// When running as CJS, we need to export the loader as a default export, since
// `tsup` exports it as `loader_default`.
// istanbul ignore next 3
// eslint-disable-next-line n/no-process-env
if (typeof module !== 'undefined' && process?.env?.NODE_ENV !== 'test') {
  module.exports = loader;
  module.exports.getFunctionLoader = getFunctionLoader;
  module.exports.raw = true;
}
