import { getPlatformVersion } from '@metamask/snaps-utils';
import {
  DEFAULT_SNAP_BUNDLE,
  DEFAULT_SNAP_ICON,
  getMockSnapFilesWithUpdatedChecksum,
  getPackageJson,
  getSnapManifest,
} from '@metamask/snaps-utils/test-utils';
import normalFs from 'fs';
import { dirname, resolve } from 'path';
import type { Configuration } from 'webpack';
import type webpackModule from 'webpack';

import { getMockConfig } from '../../test-utils';
import { getCompiler } from '../../webpack';
import type * as webpack from '../../webpack';
import type * as utils from '../../webpack/utils';
import { BROWSERSLIST_FILE } from '../../webpack/utils';
import { build } from './implementation';

const { promises: fs } = normalFs;

const BROWSERIFY_LOADER_PATH = resolve(
  __dirname,
  '../../webpack/loaders/browserify.ts',
);

jest.mock('fs');

jest.mock('../../webpack', () => ({
  ...jest.requireActual('../../webpack'),
  getCompiler: jest.fn<
    ReturnType<typeof getCompiler>,
    Parameters<typeof getCompiler>
  >(async (...args) => {
    const compiler = await jest
      .requireActual<typeof webpack>('../../webpack')
      .getCompiler(...args);

    compiler.inputFileSystem =
      normalFs as unknown as webpackModule.InputFileSystem;
    compiler.outputFileSystem =
      normalFs as unknown as webpackModule.OutputFileSystem;

    return compiler;
  }),
}));

jest.mock('../../webpack/utils', () => ({
  ...jest.requireActual('../../webpack/utils'),
  getDefaultLoader: jest.fn<
    ReturnType<typeof utils.getDefaultLoader>,
    Parameters<typeof utils.getDefaultLoader>
  >(async (config): ReturnType<typeof utils.getDefaultLoader> => {
    if (config.legacy) {
      return {
        loader: BROWSERIFY_LOADER_PATH,
        options: {
          ...config.legacy,
          fn: jest.fn(),
        },
      };
    }

    return jest
      .requireActual<typeof utils>('../../webpack/utils')
      .getDefaultLoader(config);
  }),
}));

describe('build', () => {
  beforeEach(async () => {
    const { manifest } = await getMockSnapFilesWithUpdatedChecksum({
      manifest: getSnapManifest({
        platformVersion: getPlatformVersion(),
      }),
    });

    await fs.mkdir('/snap');
    await fs.writeFile('/snap/input.js', DEFAULT_SNAP_BUNDLE);
    await fs.writeFile(
      '/snap/snap.manifest.json',
      JSON.stringify(manifest.result),
    );
    await fs.writeFile('/snap/package.json', JSON.stringify(getPackageJson()));
    await fs.mkdir('/snap/images');
    await fs.writeFile('/snap/images/icon.svg', DEFAULT_SNAP_ICON);
    await fs.mkdir(dirname(BROWSERSLIST_FILE), { recursive: true });
    await fs.writeFile(
      BROWSERSLIST_FILE,
      await jest
        .requireActual<typeof normalFs>('fs')
        .promises.readFile(BROWSERSLIST_FILE),
    );

    await fs.mkdir(dirname(BROWSERIFY_LOADER_PATH), { recursive: true });
    await fs.writeFile(
      BROWSERIFY_LOADER_PATH,
      await jest
        .requireActual<typeof normalFs>('fs')
        .promises.readFile(BROWSERIFY_LOADER_PATH),
    );
  });

  afterEach(async () => {
    await fs.rm('/snap', { force: true, recursive: true });
  });

  it('builds the snap bundle using Webpack', async () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/snap');
    const warn = jest.spyOn(console, 'warn').mockImplementation();

    const config = getMockConfig('webpack', {
      input: '/snap/input.js',
      output: {
        path: './',
        filename: 'output.js',
      },
      evaluate: false,
      manifest: {
        path: '/snap/snap.manifest.json',
      },
      customizeWebpackConfig: (webpackConfig: Configuration) => {
        delete webpackConfig.module?.rules;
        return webpackConfig;
      },
    });

    await build(config);

    // Manifest checksum mismatch is the warning
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms with 1 warning\./u),
    );

    const output = await fs.readFile('/snap/output.js', 'utf8');
    expect(output).toMatchInlineSnapshot(
      `"(()=>{var r={157:r=>{r.exports.onRpcRequest=({request:r})=>{console.log("Hello, world!");const{method:e,id:o}=r;return e+o}}},e={};var o=function o(t){var s=e[t];if(void 0!==s)return s.exports;var n=e[t]={exports:{}};return r[t](n,n.exports,o),n.exports}(157);module.exports=o})();"`,
    );
  });

  it('builds an unminimized snap bundle using Webpack', async () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/snap');
    const warn = jest.spyOn(console, 'warn').mockImplementation();

    const config = getMockConfig('webpack', {
      input: '/snap/input.js',
      output: {
        path: './',
        filename: 'output.js',
        minimize: false,
      },
      evaluate: false,
      manifest: {
        path: '/snap/snap.manifest.json',
      },
      customizeWebpackConfig: (webpackConfig: Configuration) => {
        delete webpackConfig.module?.rules;
        return webpackConfig;
      },
    });

    await build(config);

    // Manifest checksum mismatch is the warning
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms with 1 warning\./u),
    );

    const output = await fs.readFile('/snap/output.js', 'utf8');
    expect(output).toMatchInlineSnapshot(`
      "(() => {
        var __webpack_modules__ = {
          157: module => {
            module.exports.onRpcRequest = ({
              request
            }) => {
              console.log("Hello, world!");
              const {
                method,
                id
              } = request;
              return method + id;
            };
          }
        };
        var __webpack_module_cache__ = {};
        function __webpack_require__(moduleId) {
          var cachedModule = __webpack_module_cache__[moduleId];
          if (cachedModule !== undefined) {
            return cachedModule.exports;
          }
          var module = __webpack_module_cache__[moduleId] = {
            exports: {}
          };
          __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
          return module.exports;
        }
        var __webpack_exports__ = __webpack_require__(157);
        module.exports = __webpack_exports__;
      })();"
    `);
  });

  it('builds the snap bundle using a legacy config', async () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/snap');
    const warn = jest.spyOn(console, 'warn').mockImplementation();

    const config = getMockConfig('browserify', {
      cliOptions: {
        src: '/snap/input.js',
        dist: '/snap',
        outfileName: 'output.js',
        eval: false,
      },
    });

    await build(config);

    // Manifest checksum mismatch is the warning
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms with 1 warning\./u),
    );

    const output = await fs.readFile('/snap/output.js', 'utf8');

    // Browserify output is non-deterministic across different platforms (e.g.,
    // Windows vs. Linux), so we normalize it to make the snapshot
    // deterministic.
    const deterministicOutput = output
      .replace(/var r=\{(\d+):/u, 'var r={1:')
      .replace(
        /u.exports\}\(\d+\);module.exports/u,
        'u.exports}(1);module.exports',
      );

    expect(deterministicOutput).toMatchInlineSnapshot(
      `"(()=>{var r={1:r=>{r.exports=function(){function r(o,t,e){function n(s,i){if(!t[s]){if(!o[s]){if(u)return u(s,!0);var c=new Error("Cannot find module '"+s+"'");throw c.code="MODULE_NOT_FOUND",c}var f=t[s]={exports:{}};o[s][0].call(f.exports,(function(r){return n(o[s][1][r]||r)}),f,f.exports,r,o,t,e)}return t[s].exports}for(var u=void 0,s=0;s<e.length;s++)n(e[s]);return n}return r}()({1:[function(r,o,t){"use strict";o.exports.onRpcRequest=({request:r})=>{console.log("Hello, world!");const{method:o,id:t}=r;return o+t}},{}]},{},[1])(1)}},o={};var t=function t(e){var n=o[e];if(void 0!==n)return n.exports;var u=o[e]={exports:{}};return r[e](u,u.exports,t),u.exports}(1);module.exports=t})();"`,
    );
  });

  it('builds an unminimized snap bundle using a legacy config', async () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/snap');
    const warn = jest.spyOn(console, 'warn').mockImplementation();

    const config = getMockConfig('browserify', {
      cliOptions: {
        src: '/snap/input.js',
        dist: '/snap',
        outfileName: 'output.js',
        eval: false,
        stripComments: false,
      },
    });

    await build(config);

    // Manifest checksum mismatch is the warning
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/Compiled 1 file in \d+ms with 1 warning\./u),
    );

    const output = await fs.readFile('/snap/output.js', 'utf8');

    // Browserify output is non-deterministic across different platforms (e.g.,
    // Windows vs. Linux), so we normalize it to make the snapshot
    // deterministic.
    const deterministicOutput = output
      .replace(/\d+: module/u, '1: module')
      .replace(
        /var __webpack_exports__ = __webpack_require__\(\d+\);/u,
        'var __webpack_exports__ = __webpack_require__(1);',
      );

    expect(deterministicOutput).toMatchInlineSnapshot(`
      "(() => {
        var __webpack_modules__ = {
          1: module => {
            (function (f) {
              if (true) {
                module.exports = f();
              } else {
                var g;
              }
            })(function () {
              var define, module, exports;
              return function () {
                function r(e, n, t) {
                  function o(i, f) {
                    if (!n[i]) {
                      if (!e[i]) {
                        var c = undefined;
                        if (!f && c) return require(i, !0);
                        if (u) return u(i, !0);
                        var a = new Error("Cannot find module '" + i + "'");
                        throw a.code = "MODULE_NOT_FOUND", a;
                      }
                      var p = n[i] = {
                        exports: {}
                      };
                      e[i][0].call(p.exports, function (r) {
                        var n = e[i][1][r];
                        return o(n || r);
                      }, p, p.exports, r, e, n, t);
                    }
                    return n[i].exports;
                  }
                  for (var u = undefined, i = 0; i < t.length; i++) o(t[i]);
                  return o;
                }
                return r;
              }()({
                1: [function (require, module, exports) {
                  "use strict";

                  module.exports.onRpcRequest = ({
                    request
                  }) => {
                    console.log("Hello, world!");
                    const {
                      method,
                      id
                    } = request;
                    return method + id;
                  };
                }, {}]
              }, {}, [1])(1);
            });
          }
        };
        var __webpack_module_cache__ = {};
        function __webpack_require__(moduleId) {
          var cachedModule = __webpack_module_cache__[moduleId];
          if (cachedModule !== undefined) {
            return cachedModule.exports;
          }
          var module = __webpack_module_cache__[moduleId] = {
            exports: {}
          };
          __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
          return module.exports;
        }
        var __webpack_exports__ = __webpack_require__(1);
        module.exports = __webpack_exports__;
      })();"
    `);
  });

  it('rejects if the compiler has an error', async () => {
    const error = new Error('Compiler error.');
    const mock = getCompiler as jest.MockedFunction<typeof getCompiler>;
    // @ts-expect-error - Partial mock.
    mock.mockImplementationOnce(() => ({
      run: jest.fn((callback) => {
        callback(error);
      }),
    }));

    await expect(build(getMockConfig('webpack'))).rejects.toThrow(error);
  });

  it('rejects if closing the compiler has an error', async () => {
    const error = new Error('Close compiler error.');
    const mock = getCompiler as jest.MockedFunction<typeof getCompiler>;
    // @ts-expect-error - Partial mock.
    mock.mockImplementationOnce(() => ({
      run: jest.fn((callback) => {
        callback(null);
      }),
      close: jest.fn((callback) => {
        callback(error);
      }),
    }));

    await expect(build(getMockConfig('webpack'))).rejects.toThrow(error);
  });
});
