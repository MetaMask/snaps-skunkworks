import {
  DEFAULT_SNAP_BUNDLE,
  getPackageJson,
  getSnapManifest,
} from '@metamask/snaps-utils/test-utils';
import normalFs from 'fs';
import { dirname, resolve } from 'path';
import type { Configuration } from 'webpack';

import { build } from './implementation';
import { getMockConfig } from '../../test-utils';
import { getCompiler } from '../../webpack';
import type * as webpack from '../../webpack';
import type * as utils from '../../webpack/utils';
import { BROWSERSLIST_FILE } from '../../webpack/utils';

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

    compiler.inputFileSystem = normalFs;
    compiler.outputFileSystem = normalFs;

    return compiler;
  }),
}));

jest.mock('../../webpack/utils', () => ({
  ...jest.requireActual('../../webpack/utils'),
  getDefaultLoader: jest.fn<
    ReturnType<typeof utils.getDefaultLoader>,
    Parameters<typeof utils.getDefaultLoader>
  >(async (config) => {
    if (config.legacy) {
      return {
        loader: BROWSERIFY_LOADER_PATH,
        options: config.legacy,
      };
    }

    return jest
      .requireActual<typeof utils>('../../webpack/utils')
      .getDefaultLoader(config);
  }),
}));

describe('build', () => {
  beforeEach(async () => {
    await fs.mkdir('/snap');
    await fs.writeFile('/snap/input.js', DEFAULT_SNAP_BUNDLE);
    await fs.writeFile(
      '/snap/snap.manifest.json',
      JSON.stringify(getSnapManifest()),
    );
    await fs.writeFile('/snap/package.json', JSON.stringify(getPackageJson()));
    await fs.mkdir('/snap/images');
    await fs.writeFile('/snap/images/icon.svg', '<svg></svg>');
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
      `"(()=>{var e={67:e=>{e.exports.onRpcRequest=({request:e})=>{console.log("Hello, world!");const{method:r,id:o}=e;return r+o}}},r={};var o=function o(t){var s=r[t];if(void 0!==s)return s.exports;var n=r[t]={exports:{}};return e[t](n,n.exports,o),n.exports}(67),t=exports;for(var s in o)t[s]=o[s];o.__esModule&&Object.defineProperty(t,"__esModule",{value:!0})})();"`,
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
          67: module => {
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
        var __webpack_exports__ = __webpack_require__(67);
        var __webpack_export_target__ = exports;
        for (var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
        if (__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", {
          value: true
        });
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
      .replace(/u.exports\}\(\d+\),t/u, 'u.exports}(1),t');

    expect(deterministicOutput).toMatchInlineSnapshot(
      `"(()=>{var r={1:r=>{r.exports=function(){function r(e,o,t){function n(s,i){if(!o[s]){if(!e[s]){if(u)return u(s,!0);var f=new Error("Cannot find module '"+s+"'");throw f.code="MODULE_NOT_FOUND",f}var c=o[s]={exports:{}};e[s][0].call(c.exports,(function(r){return n(e[s][1][r]||r)}),c,c.exports,r,e,o,t)}return o[s].exports}for(var u=void 0,s=0;s<t.length;s++)n(t[s]);return n}return r}()({1:[function(r,e,o){"use strict";e.exports.onRpcRequest=({request:r})=>{console.log("Hello, world!");const{method:e,id:o}=r;return e+o}},{}]},{},[1])(1)}},e={};var o=function o(t){var n=e[t];if(void 0!==n)return n.exports;var u=e[t]={exports:{}};return r[t](u,u.exports,o),u.exports}(1),t=exports;for(var n in o)t[n]=o[n];o.__esModule&&Object.defineProperty(t,"__esModule",{value:!0})})();"`,
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
        var __webpack_export_target__ = exports;
        for (var i in __webpack_exports__) __webpack_export_target__[i] = __webpack_exports__[i];
        if (__webpack_exports__.__esModule) Object.defineProperty(__webpack_export_target__, "__esModule", {
          value: true
        });
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
