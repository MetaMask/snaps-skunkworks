import { promises as fsPromises } from 'fs';

import { VirtualFile } from './VirtualFile';

/**
 * Reads a file from filesystem and creates a vfile.
 *
 * @param path - Filesystem path to load the contents from.
 * @param encoding - Optional encoding to pass down to fs.readFile.
 * @returns Promise returning VFile with loaded file contents.
 */
export async function readVirtualFile(
  path: string,
  encoding: BufferEncoding | null = null,
) {
  return new VirtualFile({
    path,
    value: await fsPromises.readFile(path, { encoding }),
  });
}

type WriteVFileOptions = Exclude<
  Parameters<(typeof fsPromises)['writeFile']>[2],
  undefined
>;

/**
 * Writes vfile to filesystem.
 *
 * @param vfile - The vfile to write.
 * @param options - Options to pass down to fs.writeFile.
 * @returns Nothing.
 */
export async function writeVirtualFile(
  vfile: VirtualFile,
  options?: WriteVFileOptions,
) {
  return fsPromises.writeFile(vfile.path, vfile.value, options);
}
