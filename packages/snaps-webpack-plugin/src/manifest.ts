import type { WriteFileFunction } from '@metamask/snaps-utils/node';
import { promises as fs } from 'fs';
import { resolveConfig } from 'prettier';
import * as babel from 'prettier/plugins/babel';
import * as estree from 'prettier/plugins/estree';
import { format } from 'prettier/standalone';

/**
 * Format the manifest data with Prettier and write it to disk.
 *
 * It uses the Prettier configuration found in the project directory (if any),
 * or the default Prettier configuration if none is found.
 *
 * @param path - The path to write the manifest to.
 * @param data - The manifest data.
 * @param writeFileFn - The function to use to write the manifest.
 * @returns A promise that resolves when the manifest has been written.
 */
export async function writeManifest(
  path: string,
  data: string,
  writeFileFn: WriteFileFunction = fs.writeFile,
) {
  const config = await resolveConfig(path, {
    editorconfig: true,
  });

  const formattedManifest = await format(data, {
    ...config,
    parser: 'json',
    filepath: path,
    plugins: [babel, estree],
  });

  await writeFileFn(path, formattedManifest);
}
