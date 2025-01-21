# @metamask/snaps-cli

A CLI for developing MetaMask Snaps.

## Installation

Use Node.js `16.0.0` or later.
We recommend [nvm](https://github.com/nvm-sh/nvm) for managing Node.js versions.

Install a dev dependency in your snap project using `yarn` or `npm`:

- `npm install --save-dev @metamask/snaps-cli`
- `yarn add -D @metamask/snaps-cli`

## Usage

```text
Usage: mm-snap <command> [options]

Commands:
  mm-snap build     Build snap from source                          [aliases: b]
  mm-snap eval      Attempt to evaluate snap bundle in SES          [aliases: e]
  mm-snap manifest  Validate the snap.manifest.json file            [aliases: m]
  mm-snap serve     Locally serve Snap file(s) for testing          [aliases: s]
  mm-snap watch     Build Snap on change                            [aliases: w]

Options:
      --version           Show version number                          [boolean]
  -c, --config            Path to config file                           [string]
      --verboseErrors     Display original errors         [deprecated] [boolean]
      --suppressWarnings  Whether to suppress warnings    [deprecated] [boolean]
  -h, --help              Show help                                    [boolean]

Examples:
  mm-snap build                             Build './src/index.js' as
                                            './dist/bundle.js'
  mm-snap build --config                    Build './src/index.js' as
  ./snap.config.build.ts                    './dist/bundle.js' using the config
                                            in './snap.config.build.ts'
  mm-snap manifest --fix                    Check the snap manifest, and fix any
                                            errors
  mm-snap watch --port 8000                 The snap input file for changes, and
                                            serve it on port 8000
  mm-snap serve --port 8000                 Serve the snap bundle on port 8000
```

## MetaMask Snaps

MetaMask Snaps enables trustlessly extending the functionality of MetaMask at
runtime. A snap consist of two things: a JSON manifest and a JavaScript bundle.
At present, snaps can be published as npm packages on the public npm registry,
or hosted locally during development. In the future, it will be possible to
publish snaps on many different platforms, including arbitrary npm registries
and IPFS.

We recommend building your snap using this tool. You can bundle your snap using
your own tools, but it must run in SES and only use the global APIs that
MetaMask exposes at runtime. Although snaps currently execute in the browser,
some browser APIs are not available to snaps, and snaps do not have DOM access.

### The Snap Manifest

Your manifest must be named `snap.manifest.json` and located in the root
directory of your npm package. Here's an example manifest:

```json
{
  "version": "0.7.0",
  "proposedName": "Dialog Example",
  "description": "A MetaMask Snap template.",
  "repository": {
    "type": "git",
    "url": "https://github.com/MetaMask/template-snap.git"
  },
  "source": {
    "shasum": "w3FltkDjKQZiPwM+AThnmypt0OFF7hj4ycg/kxxv+nU=",
    "location": {
      "npm": {
        "filePath": "dist/bundle.js",
        "iconPath": "images/icon.svg",
        "packageName": "@metamask/template-snap",
        "registry": "https://registry.npmjs.org/"
      }
    }
  },
  "initialPermissions": {
    "snap_dialog": {},
    "endowment:rpc": {
      "dapps": true,
      "snaps": false
    }
  },
  "manifestVersion": "0.1"
}
```

Refer to [the Snaps publishing specification](https://github.com/MetaMask/specifications/blob/main/snaps/publishing.md)
for more information about the manifest.

> **Note**: If your snap is not compatible with the publishing specification,
> your snap may not work properly or install at all.

### Assumed Project Structure

This tool has default arguments assuming the following project structure:

```text
snap-project/
├─ package.json
├─ src/
│  ├─ index.js
├─ snap.manifest.json
├─ dist/
│  ├─ bundle.js
├─ ... (all other project files and folders)
```

Source files other than `index.js` are located through its imports. The
defaults can be overwritten using the `snap.config.js` or (`snap.config.ts`)
[config file](#configuration-file).

## Configuration

The MetaMask Snaps CLI supports a configuration file. It can be either:

- `snap.config.js` - a CommonJS module.
- `snap.config.ts` - a TypeScript module.

The file should be placed in the project root directory.

### Example

#### JavaScript

```javascript
module.exports = {
  bundler: 'webpack', // default: 'browserify'
  input: 'src/index.js',
  output: {
    path: 'dist',
  },
  server: {
    port: 9000,
  },
};
```

#### TypeScript

The CLI has full support for TypeScript out of the box. `@metamask/snaps-cli`
exports a `SnapConfig` type that can be used to type the configuration object.

```typescript
import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
  bundler: 'webpack', // default: 'browserify'
  input: 'src/index.js',
  output: {
    path: 'dist',
  },
  server: {
    port: 9000,
  },
};

export default config;
```

The configuration file should not be published.

### Options

- [`bundler`](#bundler)
- [`input`](#input)
- [`output`](#output)
  - [`output.path`](#outputpath)
  - [`output.filename`](#outputfilename)
  - [`output.clean`](#outputclean)
  - [`output.minimize`](#outputminimize)
- [`server`](#server)
  - [`server.enabled`](#serverenabled)
  - [`server.root`](#serverroot)
  - [`server.port`](#serverport)
- [`environment`](#environment)
- [`stats`](#stats)
  - [`stats.verbose`](#statsverbose)
  - [`stats.builtIns`](#statsbuiltins)
  - [`stats.buffer`](#statsbuffer)
- [`customizeWebpackConfig`](#customizewebpackconfig)
- [`experimental`](#experimental)
  - [`experimental.wasm`](#experimentalwasm)

#### `bundler`

- Type: `"browserify"` | `"webpack"`
- Default: `"browserify"`

The bundler to use. The MetaMask Snaps CLI supports both Browserify and
Webpack. For backwards compatibility, Browserify is the default, but we
recommend using Webpack. Browserify support will be removed in the future.

This section describes the options for the Webpack bundler. For Browserify,
refer to the [legacy options](#legacy-options) section.

#### `input`

- Type: `string`
- Default: `"src/index.js"`

The entry point of your snap. This is the file that will be bundled.

#### `output`

- Type: `object`

The output configuration.

##### `output.path`

- Type: `string`
- Default: `"dist"`

The output directory.

##### `output.filename`

- Type: `string`
- Default: `"bundle.js"`

The output filename.

##### `output.clean`

- Type: `boolean`
- Default: `false`

Whether to clean the output directory before building.

##### `output.minimize`

- Type: `boolean`
- Default: `true`

Whether to minimize the bundle. This will remove comments and whitespace from
the bundle, mangle variable names, and perform other optimizations.

#### `sourceMap`

- Type: `boolean | "inline"`
- Default: `true`

Whether to generate a source map. If `"inline"`, the source map will be
inlined in the bundle. Otherwise, it will be written to a separate file.

#### `evaluate`

- Type: `boolean`

Whether to evaluate the bundle. This will check the bundle for compatibility
issues with the MetaMask Snaps runtime. If there are any issues, the CLI will
exit with an error.

#### `manifest`

- Type: `object`

The snap manifest configuration.

##### `manifest.path`

- Type: `string`
- Default: `"snap.manifest.json"`

The path to the snap manifest, i.e., `snap.manifest.json`.

##### `manifest.update`

- Type: `boolean`
- Default: `true`

Whether to update the manifest with the bundle shasum, and any other possible
updates. If `false`, the manifest will not be updated, and an error will be
thrown if the manifest is not up-to-date.

#### `server`

- Type: `object`

The development server configuration. The development server is used to test
your snap during development, using the `watch` and `serve` commands.

##### `server.enabled`

- Type: `boolean`
- Default: `true`

Whether to enable the development server. If `false`, the development server
will not be started when running the `watch` command. This option has no effect
on the `serve` command.

##### `server.root`

- Type: `string`
- Default: `process.cwd()`

The root directory of the development server. This is the directory that will
be served by the development server.

##### `server.port`

- Type: `number`
- Default: `8081`

The port to run the development server on. If set to `0`, a random port will
be used.

##### `server.host`

- Type: `string`
- Default: `localhost`

The hostname to run the development server on.

#### `environment`

- Type: `Record<string, unknown>`

The environment configuration. This is used to set environment variables for
the snap, which can be accessed using `process.env`.

In addition to the environment variables set by the user, the following
environment variables are set by the CLI:

- `NODE_ENV` - `"production"`.
- `NODE_DEBUG` - `false`.
- `DEBUG` - `false`.

#### `stats`

- Type: `object`

The stats configuration, which controls the log output of the CLI.

##### `stats.verbose`

- Type: `boolean`
- Default: `false`

Whether to enable verbose logging. If `true`, the CLI will log more
information.

##### `stats.builtIns`

- Type: `false | object`
- Default: `{ ignore: [] }`

Whether to check for missing built-in modules. The MetaMask Snaps CLI does not
support Node.js built-ins out of the box, and any used built-ins must be
provided through the `customizeWebpackConfig` option. When enabled, the CLI
shows a warning if a built-in module is used, but not provided.

###### `stats.builtIns.ignore`

- Type: `string[]`

A list of built-in modules to ignore. This is useful if the built-in module is
not actually used in the snap, but is added by a dependency.

###### `stats.buffer`

- Type: `boolean`
- Default: `true`

Whether to show a warning if `Buffer` is used, but not provided. The `Buffer`
global is not available in the MetaMask Snaps runtime by default, and must
be provided through the `customizeWebpackConfig` option.

#### `customizeWebpackConfig`

- Type: `(config: webpack.Configuration) => webpack.Configuration`

A function that can be used to customize the Webpack configuration. This is
useful if you need to add a Webpack plugin, provide a polyfill, add a loader,
and so on.

The function receives the Webpack configuration object, and should return the
modified configuration object. For convenience, `@metamask/snaps-cli` exports
a `merge` function (re-exported from `webpack-merge`) that can be used to merge
the configuration object with the default configuration.

The default configuration can be found in [`src/webpack/config.ts`](./src/webpack/config.ts).

```typescript
import type { SnapConfig } from '@metamask/snaps-cli';
import { merge } from '@metamask/snaps-cli';

const config: SnapConfig = {
  customizeWebpackConfig: (config) =>
    merge(config, {
      plugins: [
        // Add a plugin.
      ],
      module: {
        rules: [
          // Add a loader.
        ],
      },
    }),
};

export default config;
```

#### `experimental`

- Type: `object`

Experimental features. These features are not stable, and may change in the
future.

##### `experimental.wasm`

- Type: `boolean`

Whether to enable WebAssembly support. When this is enabled, WebAssembly files
can be imported in the snap, for example:

```typescript
import program from './program.wasm';

// Program is initialised synchronously.
// ...
```

### Legacy Options

> **Warning**: Using the Browserify-based build system is deprecated, and will
> be removed in a future version. Please migrate to the Webpack-based build
> system.

- [`bundler`](#bundler)
- [`cliOptions`](#clioptions)
  - [`cliOptions.bundle`](#clioptionsbundle)
  - [`cliOptions.dist`](#clioptionsdist)
  - [`cliOptions.eval`](#clioptionseval)
  - [`cliOptions.manifest`](#clioptionsmanifest)
  - [`cliOptions.outfileName`](#clioptionsoutfilename)
  - [`cliOptions.port`](#clioptionsport)
  - [`cliOptions.root`](#clioptionsroot)
  - [`cliOptions.sourceMaps`](#clioptionssourcemaps)
  - [`cliOptions.src`](#clioptionssrc)
  - [`cliOptions.stripComments`](#clioptionsstripcomments)
  - [`cliOptions.transpilationMode`](#clioptionstranspilationmode)
  - [`cliOptions.depsToTranspile`](#clioptionsdepstotranspile)
  - [`cliOptions.writeManifest`](#clioptionswritemanifest)
  - [`cliOptions.serve`](#clioptionsserve)
  - [`cliOptions.verboseErrors`](#clioptionsverboseerrors)
  - [`cliOptions.suppressWarnings`](#clioptionssuppresswarnings)
- [`bundlerCustomizer`](#bundlercustomizer)

#### `bundler`

- Type: `"browserify"` | `"webpack"`
- Default: `"browserify"`

The bundler to use. The MetaMask Snaps CLI supports both Browserify and
Webpack. For backwards compatibility, Browserify is the default, but we
recommend using Webpack. Browserify support will be removed in the future.

This section describes the options for the Browserify bundler. For Webpack,
refer to the [options](#options) section.

#### `cliOptions`

- Type: `object`

The CLI options. These can be specified using the CLI, but can also be
specified in the configuration file. For example, the `--port` option can be
specified in the configuration file as follows:

```ts
export default {
  cliOptions: {
    port: 8081,
  },
};
```

But can also be specified using the CLI:

```bash
$ mm-snap serve --port 8081
```

If the same option is specified in both the configuration file and the CLI,
the CLI option takes precedence.

##### `cliOptions.bundle`

- Type: `string`
- Default: `dist/bundle.js`

The path to the bundle file. This is where the bundle will be written to.

##### `cliOptions.dist`

- Type: `string`
- Default: `dist`

The path to the distribution directory. This is where the bundle file will be
written to, if the `bundle` option is not specified.

##### `cliOptions.eval`

- Type: `boolean`
- Default: `true`

Whether to evaluate the bundle. If `true`, the bundle will be evaluated in the
MetaMask Snaps runtime, to check for any compatibility issues.

##### `cliOptions.manifest`

- Type: `boolean`
- Default: `true`

Whether to validate the snap manifest. If `true`, the snap manifest will be
validated, and any errors or warnings will be shown.

##### `cliOptions.outfileName`

- Type: `string`
- Default: `bundle.js`

The name of the bundle file. This is used to generate the bundle file path,
using the `dist` option. For example, if `dist` is `dist`, and `outfileName`
is `bundle.js`, the bundle file path will be `dist/bundle.js`. This option is
ignored if the `bundle` option is specified.

##### `cliOptions.port`

- Type: `number`
- Default: `8081`

The port to use for the development server.

##### `cliOptions.root`

- Type: `string`
- Default: `.`

The root directory. This should be the directory that contains the snap
manifest, and the `dist` directory. This will be served by the development
server.

##### `cliOptions.sourceMaps`

- Type: `boolean`
- Default: `false`

Whether to generate source maps. If `true`, source maps will be generated for
the bundle.

##### `cliOptions.src`

- Type: `string`
- Default: `src/index.js`

The path to the entry file. This is the file that will be bundled.

##### `cliOptions.stripComments`

- Type: `boolean`
- Default: `true`

Whether to strip comments from the bundle. If `true`, comments will be stripped
from the bundle, and the bundle will be minified.

##### `cliOptions.transpilationMode`

- Type: `'localAndDeps' | 'localOnly' | 'none'`
- Default: `'localOnly'`

The transpilation mode to use. This determines which files will be transpiled
by Babel. The possible values are:

- `'localAndDeps'`: Transpile all files, including dependencies.
- `'localOnly'`: Transpile only local files.
- `'none'`: Do not transpile any files.

##### `cliOptions.depsToTranspile`

- Type: `string[]`
- Default: `[]`

If `transpilationMode` is `'localAndDeps'`, this option can be used to specify
which dependencies should be transpiled. This is useful if you want to transpile
a limited set of dependencies, but not all of them.

##### `cliOptions.writeManifest`

- Type: `boolean`
- Default: `true`

Whether to write the snap manifest. If `true`, the snap manifest will be written
with any changes made by the CLI, if the manifest is invalid.

##### `cliOptions.serve`

- Type: `boolean`
- Default: `true`

Whether to serve the snap. If `true`, the snap will be served by the development
server, when running `mm-snap watch`.

##### `cliOptions.suppressWarnings`

- Type: `boolean`
- Default: `false`

This option exists for backwards compatibility, and is ignored.

##### `cliOptions.verboseErrors`

- Type: `boolean`
- Default: `false`

This option exists for backwards compatibility, and is ignored.

#### `bundlerCustomizer`

- Type: `(bundler: BrowserifyObject) => void`

A function that customizes the bundler. This function is called after the
bundler is created, but before the bundle is written to disk. This can be used
to customize the bundler, for example to add plugins or transforms.

```typescript
import type { SnapConfig } from '@metamask/snaps-cli';
import type { BrowserifyObject } from 'browserify';

const config: SnapConfig = {
  bundlerCustomizer: (bundler: BrowserifyObject) => {
    // Add the BRFS transform to Browserify.
    bundler.transform('brfs');
  },
};

export default config;
```
