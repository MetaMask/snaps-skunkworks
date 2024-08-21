import type { SpawnSyncReturns } from 'child_process';
import childProcess from 'child_process';
import { promises as fs } from 'fs';
import pathUtils from 'path';

import {
  buildSnap,
  cloneTemplate,
  gitInitWithCommit,
  isGitInstalled,
  isInGitRepository,
  prepareWorkingDirectory,
  yarnInstall,
  TEMPLATE_GIT_URL,
} from './initUtils';
import { resetFileSystem } from '../../test-utils';

jest.mock('fs');

jest.mock('process', () => ({
  ...jest.requireActual('process'),
  cwd: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const spawnReturnWithStatus = (status: number): SpawnSyncReturns<Buffer> => ({
  status,
  signal: null,
  pid: 1000,
  output: [],
  stdout: Buffer.from(''),
  stderr: Buffer.from(''),
});

describe('initUtils', () => {
  beforeEach(async () => {
    await resetFileSystem();
  });

  describe('prepareWorkingDirectory', () => {
    it('creates a new directory if needed', async () => {
      // eslint-disable-next-line jest/no-restricted-matchers
      await expect(prepareWorkingDirectory('foo')).resolves.toBeUndefined();
    });

    it("does not create a directory if it's using the current working directory", async () => {
      await prepareWorkingDirectory(process.cwd());

      expect(await fs.readdir(process.cwd())).toStrictEqual([]);
    });

    it('throws an error if it fails to create a new directory', async () => {
      jest.spyOn(fs, 'mkdir').mockImplementation(() => {
        throw new Error('error message');
      });

      await expect(prepareWorkingDirectory('bar')).rejects.toThrow(
        'Init Error: Failed to prepare working directory with message: Init Error: Failed to create new directory.',
      );
    });

    it('throws if the folder is not empty', async () => {
      const folderPath = 'bar';
      const filePath = pathUtils.join(folderPath, 'foo.txt');

      await fs.mkdir(folderPath);
      await fs.appendFile(filePath, 'test');

      await expect(prepareWorkingDirectory('bar')).rejects.toThrow(
        'Init Error: Failed to prepare working directory with message: Directory bar not empty.',
      );
    });
  });

  describe('buildSnap', () => {
    it('calls spawnSync', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      buildSnap('foo');

      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock).toHaveBeenCalledWith('yarn', ['build'], {
        stdio: [0, 1, 2],
        cwd: pathUtils.resolve(__dirname, 'foo'),
      });
    });

    it('throws an error when execution fails', () => {
      jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(1));

      expect(() => buildSnap('foo')).toThrow(
        'Init Error: Failed to build snap.',
      );
    });
  });

  describe('cloneTemplate', () => {
    it('passes if the command is ran successfully', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      cloneTemplate('foo');

      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth=1', TEMPLATE_GIT_URL, 'foo'],
        {
          stdio: [2],
        },
      );
    });

    it('throws if the command fails', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(1));

      expect(() => cloneTemplate('foo')).toThrow(
        'Init Error: Failed to clone the template.',
      );
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('isGitInstalled', () => {
    it('returns true if git is installed', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      const result = isGitInstalled();

      expect(result).toBe(true);
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock).toHaveBeenCalledWith('git', ['--version'], {
        stdio: 'ignore',
      });
    });

    it('returns false if git is not installed', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(1));

      const result = isGitInstalled();

      expect(result).toBe(false);
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('isInGitRepository', () => {
    it('returns true if the directory is a git repository', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      const result = isInGitRepository('foo');

      expect(result).toBe(true);
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--is-inside-work-tree'],
        {
          stdio: 'ignore',
          cwd: pathUtils.resolve(__dirname, 'foo'),
        },
      );
    });

    it('returns false if the directory is not a git repository', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(128));

      const result = isInGitRepository('foo');

      expect(result).toBe(false);
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('gitInitWithCommit', () => {
    it('init a new repository', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      gitInitWithCommit('foo');

      expect(spawnSyncMock).toHaveBeenCalledTimes(3);
      expect(spawnSyncMock).toHaveBeenNthCalledWith(1, 'git', ['init'], {
        stdio: 'ignore',
        cwd: pathUtils.resolve(__dirname, 'foo'),
      });
      expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'git', ['add', '.'], {
        stdio: 'ignore',
        cwd: pathUtils.resolve(__dirname, 'foo'),
      });
      expect(spawnSyncMock).toHaveBeenNthCalledWith(
        3,
        'git',
        ['commit', '-m', 'Initial commit from @metamask/create-snap'],
        {
          stdio: 'ignore',
          cwd: pathUtils.resolve(__dirname, 'foo'),
        },
      );
    });

    it('throws an error if it fails to init a new repository', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(1));

      expect(() => gitInitWithCommit('foo')).toThrow(
        'Init Error: Failed to init a new git repository.',
      );
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('yarnInstall', () => {
    it('run yarn and yarn install commands', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(0));

      yarnInstall('foo');

      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
      expect(spawnSyncMock).toHaveBeenCalledWith('yarn', ['install'], {
        stdio: [0, 1, 2],
        cwd: 'foo',
      });
    });

    it('throws an error if it fails to run a command', () => {
      const spawnSyncMock = jest
        .spyOn(childProcess, 'spawnSync')
        .mockImplementation(() => spawnReturnWithStatus(1));

      expect(() => yarnInstall('foo')).toThrow(
        'Init Error: Failed to install dependencies.',
      );
      expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    });
  });
});
