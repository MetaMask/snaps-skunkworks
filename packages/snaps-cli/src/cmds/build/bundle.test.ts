import browserify from 'browserify';
import { TranspilationModes } from '../../builders';
import { bundle } from './bundle';
import * as bundleUtils from './utils';

jest.mock('browserify');
jest.mock('babelify', () => 'mockBabelify');

describe('bundle', () => {
  global.snaps = {
    verboseErrors: false,
    isWatching: false,
  };

  describe('bundle', () => {
    it('handles all options enabled', async () => {
      const mockArgv = {
        sourceMaps: true,
        stripComments: true,
        transpilationMode: TranspilationModes.localOnly,
      };

      const mockTransform = jest.fn();
      const mockBrowserify = (browserify as jest.Mock).mockImplementation(
        () => ({
          transform: mockTransform,
          bundle: (cb: () => any) => {
            cb();
          },
        }),
      );
      const closeStreamMock = jest
        .spyOn(bundleUtils, 'closeBundleStream')
        .mockImplementation((({ resolve }: { resolve: () => any }) =>
          resolve()) as any);

      await bundle('src', 'dest', mockArgv as any);
      expect(mockBrowserify).toHaveBeenCalledWith('src', { debug: true });
      expect(mockTransform).toHaveBeenCalledTimes(1);
      expect(mockTransform).toHaveBeenCalledWith(
        'mockBabelify',
        expect.objectContaining({ global: false }),
      );
      expect(closeStreamMock).toHaveBeenCalledTimes(1);
    });

    it('handles sourceMaps: false', async () => {
      const mockArgv = {
        sourceMaps: false,
        stripComments: true,
        transpilationMode: TranspilationModes.localOnly,
      };

      const mockTransform = jest.fn();
      const mockBrowserify = (browserify as jest.Mock).mockImplementation(
        () => ({
          transform: mockTransform,
          bundle: (cb: () => any) => {
            cb();
          },
        }),
      );
      const closeStreamMock = jest
        .spyOn(bundleUtils, 'closeBundleStream')
        .mockImplementation((({ resolve }: { resolve: () => any }) =>
          resolve()) as any);

      await bundle('src', 'dest', mockArgv as any);
      expect(mockBrowserify).toHaveBeenCalledWith('src', { debug: false });
      expect(mockTransform).toHaveBeenCalledTimes(1);
      expect(mockTransform).toHaveBeenCalledWith(
        'mockBabelify',
        expect.objectContaining({ global: false }),
      );
      expect(closeStreamMock).toHaveBeenCalledTimes(1);
    });

    it('handles transpilationMode: localOnly', async () => {
      const mockArgv = {
        sourceMaps: true,
        stripComments: true,
        transpilationMode: TranspilationModes.localOnly,
      };

      const mockTransform = jest.fn();
      const mockBrowserify = (browserify as jest.Mock).mockImplementation(
        () => ({
          transform: mockTransform,
          bundle: (cb: () => any) => {
            cb();
          },
        }),
      );
      const closeStreamMock = jest
        .spyOn(bundleUtils, 'closeBundleStream')
        .mockImplementation((({ resolve }: { resolve: () => any }) =>
          resolve()) as any);

      await bundle('src', 'dest', mockArgv as any);
      expect(mockBrowserify).toHaveBeenCalledWith('src', { debug: true });
      expect(mockTransform).toHaveBeenCalledTimes(1);
      expect(mockTransform).toHaveBeenCalledWith(
        'mockBabelify',
        expect.objectContaining({ global: false }),
      );
      expect(closeStreamMock).toHaveBeenCalledTimes(1);
    });

    it('handles transpilationMode: none', async () => {
      const mockArgv = {
        sourceMaps: true,
        stripComments: true,
        transpilationMode: TranspilationModes.none,
      };

      const mockTransform = jest.fn();
      const mockBrowserify = (browserify as jest.Mock).mockImplementation(
        () => ({
          transform: mockTransform,
          bundle: (cb: () => any) => {
            cb();
          },
        }),
      );
      const closeStreamMock = jest
        .spyOn(bundleUtils, 'closeBundleStream')
        .mockImplementation((({ resolve }: { resolve: () => any }) =>
          resolve()) as any);

      await bundle('src', 'dest', mockArgv as any);
      expect(mockBrowserify).toHaveBeenCalledWith('src', { debug: true });
      expect(mockTransform).not.toHaveBeenCalled();
      expect(closeStreamMock).toHaveBeenCalledTimes(1);
    });

    it('handles transpilationMode: localAndDeps', async () => {
      const mockArgv = {
        sourceMaps: true,
        stripComments: true,
        transpilationMode: TranspilationModes.localAndDeps,
      };

      const mockTransform = jest.fn();
      const mockBrowserify = (browserify as jest.Mock).mockImplementation(
        () => ({
          transform: mockTransform,
          bundle: (cb: () => any) => {
            cb();
          },
        }),
      );
      const closeStreamMock = jest
        .spyOn(bundleUtils, 'closeBundleStream')
        .mockImplementation((({ resolve }: { resolve: () => any }) =>
          resolve()) as any);

      await bundle('src', 'dest', mockArgv as any);
      expect(mockBrowserify).toHaveBeenCalledWith('src', { debug: true });
      expect(mockTransform).toHaveBeenCalledTimes(1);
      expect(mockTransform).toHaveBeenCalledWith(
        'mockBabelify',
        expect.objectContaining({ global: true }),
      );
      expect(closeStreamMock).toHaveBeenCalledTimes(1);
    });
  });
});
