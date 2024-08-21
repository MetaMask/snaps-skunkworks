import { getMockConfig } from '@metamask/snaps-cli/test-utils';

import {
  getDependencyRegExp,
  processDependencies,
  sanitizeDependencyPaths,
} from './legacy';
import { TranspilationModes } from '../builders';

describe('processDependencies', () => {
  it('returns an empty array when `transpilationMode` is not `localAndDeps`', () => {
    const config = getMockConfig('browserify', {
      cliOptions: {
        transpilationMode: TranspilationModes.LocalOnly,
      },
    });

    const result = processDependencies(config.legacy);
    expect(result).toStrictEqual([]);
  });

  it('returns an array with a regex when `transpilationMode` is `localAndDeps`', () => {
    const config = getMockConfig('browserify', {
      cliOptions: {
        transpilationMode: TranspilationModes.LocalAndDeps,
        depsToTranspile: ['@metamask/snaps'],
      },
    });

    const result = processDependencies(config.legacy);
    expect(result).toStrictEqual([/\/node_modules\/(?!@metamask\/snaps)/u]);
  });

  it('returns an empty array when `depsToTranspile` is empty', () => {
    const config = getMockConfig('browserify', {
      cliOptions: {
        transpilationMode: TranspilationModes.LocalAndDeps,
        depsToTranspile: [],
      },
    });

    const result = processDependencies(config.legacy);
    expect(result).toStrictEqual([]);
  });
});

describe('getDependencyRegExp', () => {
  it('returns null when `depsToTranspile` is empty', () => {
    const result = getDependencyRegExp([]);
    expect(result).toBeNull();
  });

  it('returns null when `depsToTranspile` includes a dot', () => {
    const result = getDependencyRegExp(['@metamask/snaps', '.']);
    expect(result).toBeNull();
  });

  it('returns null when `depsToTranspile` is undefined', () => {
    const result = getDependencyRegExp(undefined as any);
    expect(result).toBeNull();
  });

  it('returns a RegExp when `depsToTranspile` is not empty', () => {
    const result = getDependencyRegExp(['@metamask/snaps']);
    expect(result).toBeInstanceOf(RegExp);
  });

  it('returns a RegExp that matches the provided dependencies', () => {
    const result = getDependencyRegExp(['@metamask/snaps', 'foo']);
    expect(result?.test('/node_modules/@metamask/snaps/')).toBe(false);
    expect(result?.test('/node_modules/foo/')).toBe(false);
    expect(result?.test('/node_modules/bar/')).toBe(true);
  });
});

describe('sanitizeDependencyPaths', () => {
  it('removes leading and trailing slashes', () => {
    const result = sanitizeDependencyPaths(['/foo/', '/bar', 'baz/', 'qux']);
    expect(result).toStrictEqual(['foo', 'bar', 'baz', 'qux']);
  });
});
