import type { Configuration } from 'webpack';
import { Compiler } from 'webpack';
import merge from 'webpack-merge';

import { getCompiler } from './compiler';
import { getMockConfig } from '../test-utils';

jest.dontMock('fs');
jest.mock('serve-handler', () =>
  jest.fn().mockImplementation((_request, response) => {
    response.end();
  }),
);

describe('getCompiler', () => {
  it('returns a Webpack compiler for the given config', async () => {
    const config = getMockConfig('webpack', {
      input: 'src/index.js',
    });

    const compiler = await getCompiler(config);
    expect(compiler).toBeInstanceOf(Compiler);
    expect(compiler.options.entry).toStrictEqual({
      main: {
        import: [config.input],
      },
    });
  });

  it('modifies the Webpack config if a customizer is provided', async () => {
    const config = getMockConfig('webpack', {
      input: 'src/index.js',
      customizeWebpackConfig: (webpackConfig: Configuration) =>
        merge(webpackConfig, {
          entry: 'src/other.js',
        }),
    });

    const compiler = await getCompiler(config);
    expect(compiler).toBeInstanceOf(Compiler);
    expect(compiler.options.entry).toStrictEqual({
      main: {
        import: ['src/other.js'],
      },
    });
  });
});
