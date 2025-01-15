// @ts-check
// This file is used to define, among other configuration, rules that Yarn will
// execute when you run `yarn constraints`. These rules primarily check the
// manifests of each package in the monorepo to ensure they follow a standard
// format, but also check the presence of certain files as well.

/* eslint-disable jsdoc/valid-types */

const { defineConfig } = require('@yarnpkg/types');
const { readFile } = require('fs/promises');
const { get } = require('lodash');
const { basename, resolve, join, relative } = require('path');
const { inspect } = require('util');

const BASE_KEYWORDS = ['MetaMask', 'Snaps', 'Ethereum'];

/**
 * Aliases for the Yarn type definitions, to make the code more readable.
 *
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Yarn} Yarn
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Workspace} Workspace
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Dependency} Dependency
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.DependencyType} DependencyType
 */

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const rootWorkspace = Yarn.workspace({ cwd: '.' });
    if (rootWorkspace === null) {
      throw new Error('Could not find root workspace.');
    }

    const repositoryUri = rootWorkspace.manifest.repository.url.replace(
      /\.git$/u,
      '',
    );

    for (const workspace of Yarn.workspaces()) {
      const workspaceBasename = getWorkspaceBasename(workspace);
      const isChildWorkspace = workspace.cwd !== '.';
      const isPrivate =
        'private' in workspace.manifest && workspace.manifest.private === true;
      const dependenciesByIdentAndType = getDependenciesByIdentAndType(
        Yarn.dependencies({ workspace }),
      );

      const isExample = workspace.cwd.startsWith('packages/examples');

      // All packages must have a name.
      expectWorkspaceField(workspace, 'name');

      if (isChildWorkspace) {
        if (!isExample) {
          // All non-root, non-example packages must have a name that matches its
          // directory (e.g., a package in a workspace directory called `foo` must
          // be called `@metamask/foo`).
          expectWorkspaceField(
            workspace,
            'name',
            `@metamask/${workspaceBasename}`,
          );
        }

        // All non-root packages must have a version.
        expectWorkspaceField(workspace, 'version');

        // All non-root packages must have a description that ends in a period.
        expectWorkspaceDescription(workspace);

        // All non-root packages must include the same set of NPM keywords.
        const customKeywords = get(workspace.manifest, 'keywords').filter(
          (keyword) => !BASE_KEYWORDS.includes(keyword),
        );
        expectWorkspaceField(workspace, 'keywords', [
          ...BASE_KEYWORDS,
          ...customKeywords,
        ]);

        // All non-root packages must have a homepage URL that includes its name.
        expectWorkspaceField(
          workspace,
          'homepage',
          `${repositoryUri}/tree/main/${relative(
            __dirname,
            workspace.cwd,
          )}#readme`,
        );

        // All non-root packages must have a URL for reporting bugs that points
        // to the Issues page for the repository.
        expectWorkspaceField(workspace, 'bugs.url', `${repositoryUri}/issues`);

        // All non-root packages must specify a Git repository within the
        // MetaMask GitHub organization.
        expectWorkspaceField(workspace, 'repository.type', 'git');
        expectWorkspaceField(
          workspace,
          'repository.url',
          `${repositoryUri}.git`,
        );

        // All non-root packages must have a license, defaulting to MIT.
        await expectWorkspaceLicense(workspace);

        // All non-root packages must not have side effects.
        expectWorkspaceField(workspace, 'sideEffects', false);

        if (!isPrivate && !isExample) {
          // All non-root, non-example packages must set up ESM- and
          // CommonJS-compatible exports correctly.
          expectCorrectWorkspaceExports(workspace);
        }

        // All non-root, non-example packages must have the same "build" script.
        if (
          !isExample &&
          workspace.cwd !== 'packages/test-snaps' &&
          workspace.cwd !== 'packages/snaps-simulator'
        ) {
          expectWorkspaceField(
            workspace,
            'scripts.build',
            'ts-bridge --project tsconfig.build.json --verbose --clean --no-references',
          );
        }

        if (isPrivate) {
          // All private, non-root packages must not have a "publish:preview"
          // script.
          workspace.unset('scripts.publish:preview');
        } else {
          // All non-private, non-root packages must have the same
          // "publish:preview" script.
          expectWorkspaceField(
            workspace,
            'scripts.publish:preview',
            'yarn npm publish --tag preview',
          );
        }

        // No non-root packages may have a "prepack" script.
        workspace.unset('scripts.prepack');

        // All non-root package must have valid "changelog:update" and
        // "changelog:validate" scripts.
        expectWorkspaceField(
          workspace,
          'scripts.changelog:validate',
          `${getRelativePath(workspace, 'scripts/validate-changelog.sh')} ${
            workspace.manifest.name
          }`,
        );
        expectWorkspaceField(
          workspace,
          'scripts.changelog:validate',
          `${getRelativePath(workspace, 'scripts/validate-changelog.sh')} ${
            workspace.manifest.name
          }`,
        );

        // All non-root packages must have a valid "since-latest-release" script.
        expectWorkspaceField(
          workspace,
          'scripts.since-latest-release',
          getRelativePath(workspace, 'scripts', 'since-latest-release.sh'),
        );

        if (
          workspace.cwd !== 'packages/examples' &&
          workspace.cwd !== 'packages/snaps-simulator'
        ) {
          // All non-root packages must have the same "test" script.
          if (workspace.manifest.scripts['test:browser']) {
            expectWorkspaceField(
              workspace,
              'scripts.test',
              'node --experimental-vm-modules $(yarn bin jest) --reporters=jest-silent-reporter && yarn test:browser',
            );
          } else {
            expectWorkspaceField(
              workspace,
              'scripts.test',
              'node --experimental-vm-modules $(yarn bin jest) --reporters=jest-silent-reporter',
            );
          }

          // All non-root packages must have the same "test:clean" script.
          expectWorkspaceField(
            workspace,
            'scripts.test:clean',
            'node --experimental-vm-modules $(yarn bin jest) --clearCache',
          );

          // All non-root packages must have the same "test:verbose" script.
          expectWorkspaceField(
            workspace,
            'scripts.test:verbose',
            'node --experimental-vm-modules $(yarn bin jest) --verbose',
          );

          // All non-root packages must have the same "test:watch" script.
          expectWorkspaceField(
            workspace,
            'scripts.test:watch',
            'node --experimental-vm-modules $(yarn bin jest) --watch',
          );
        }
      }

      if (isChildWorkspace && !isPrivate) {
        // The list of files included in all non-root packages must only include
        // files generated during the build process.
        expectWorkspaceArrayField(workspace, 'files', 'dist');
      } else {
        // The root package must specify an empty set of published files. (This
        // is required in order to be able to import anything in
        // development-only scripts, as otherwise the
        // `node/no-unpublished-require` ESLint rule will disallow it.)
        expectWorkspaceField(workspace, 'files', []);
      }

      // If one workspace package lists another workspace package within
      // `dependencies` or `devDependencies`, the version used within the
      // dependency range must match the current version of the dependency.
      expectUpToDateWorkspaceDependenciesAndDevDependencies(Yarn, workspace);

      // If one workspace package lists another workspace package within
      // `peerDependencies`, the dependency range must satisfy the current
      // version of that package.
      expectUpToDateWorkspacePeerDependencies(Yarn, workspace);

      // No dependency may be listed under both `dependencies` and
      // `devDependencies`.
      expectDependenciesNotInBothProdAndDev(
        workspace,
        dependenciesByIdentAndType,
      );

      // The root workspace (and only the root workspace) must specify the Yarn
      // version required for development.
      if (isChildWorkspace) {
        workspace.unset('packageManager');
      } else {
        expectWorkspaceField(workspace, 'packageManager', 'yarn@4.4.1');
      }

      // All packages must specify a minimum Node.js version of 18.18.
      expectWorkspaceField(workspace, 'engines.node', '^18.16 || >=20');

      // All non-root public packages should be published to the NPM registry;
      // all non-root private packages should not.
      if (isPrivate) {
        workspace.unset('publishConfig');
      } else {
        expectWorkspaceField(workspace, 'publishConfig.access', 'public');
        expectWorkspaceField(
          workspace,
          'publishConfig.registry',
          'https://registry.npmjs.org/',
        );
      }
    }

    // All version ranges in `dependencies` and `devDependencies` for the same
    // dependency across the monorepo must be the same.
    expectConsistentDependenciesAndDevDependencies(Yarn);
  },
});

/**
 * Get the relative path to a file from the workspace root.
 *
 * @param {Workspace} workspace - The workspace.
 * @param {string} path - The path to the file, relative to the workspace
 * root.
 * @returns {string} The relative path to the script.
 */
function getRelativePath(workspace, ...path) {
  return join(relative(workspace.cwd, __dirname), ...path);
}

/**
 * Construct a nested map of dependencies. The inner layer categorizes
 * instances of the same dependency by its location in the manifest; the outer
 * layer categorizes the inner layer by the name of the dependency.
 *
 * @param {Dependency[]} dependencies - The list of dependencies to transform.
 * @returns {Map<string, Map<DependencyType, Dependency>>} The resulting map.
 */
function getDependenciesByIdentAndType(dependencies) {
  const dependenciesByIdentAndType = new Map();

  for (const dependency of dependencies) {
    const dependenciesForIdent = dependenciesByIdentAndType.get(
      dependency.ident,
    );

    if (dependenciesForIdent === undefined) {
      dependenciesByIdentAndType.set(
        dependency.ident,
        new Map([[dependency.type, dependency]]),
      );
    } else {
      dependenciesForIdent.set(dependency.type, dependency);
    }
  }

  return dependenciesByIdentAndType;
}

/**
 * Construct a nested map of non-peer dependencies (`dependencies` and
 * `devDependencies`). The inner layer categorizes instances of the same
 * dependency by the version range specified; the outer layer categorizes the
 * inner layer by the name of the dependency itself.
 *
 * @param {Dependency[]} dependencies - The list of dependencies to transform.
 * @returns {Map<string, Map<string, Dependency[]>>} The resulting map.
 */
function getNonPeerDependenciesByIdent(dependencies) {
  const nonPeerDependenciesByIdent = new Map();

  for (const dependency of dependencies) {
    if (dependency.type === 'peerDependencies') {
      continue;
    }

    const dependencyRangesForIdent = nonPeerDependenciesByIdent.get(
      dependency.ident,
    );

    if (dependencyRangesForIdent === undefined) {
      nonPeerDependenciesByIdent.set(
        dependency.ident,
        new Map([[dependency.range, [dependency]]]),
      );
    } else {
      const dependenciesForDependencyRange = dependencyRangesForIdent.get(
        dependency.range,
      );

      if (dependenciesForDependencyRange === undefined) {
        dependencyRangesForIdent.set(dependency.range, [dependency]);
      } else {
        dependenciesForDependencyRange.push(dependency);
      }
    }
  }

  return nonPeerDependenciesByIdent;
}

/**
 * Get the basename of the workspace's directory. The workspace directory is
 * expected to be in the form `<directory>/<package-name>`, and this function
 * will extract `<package-name>`.
 *
 * @param {Workspace} workspace - The workspace.
 * @returns {string} The name of the workspace.
 */
function getWorkspaceBasename(workspace) {
  return basename(workspace.cwd);
}

/**
 * Get the absolute path to a file within the workspace.
 *
 * @param {Workspace} workspace - The workspace.
 * @param {string} path - The path to the file, relative to the workspace root.
 * @returns {string} The absolute path to the file.
 */
function getWorkspacePath(workspace, path) {
  return resolve(__dirname, workspace.cwd, path);
}

/**
 * Get the contents of a file within the workspace. The file is expected to be
 * encoded as UTF-8.
 *
 * @param {Workspace} workspace - The workspace.
 * @param {string} path - The path to the file, relative to the workspace root.
 * @returns {Promise<string>} The contents of the file.
 */
async function getWorkspaceFile(workspace, path) {
  return await readFile(getWorkspacePath(workspace, path), 'utf8');
}

/**
 * Attempts to access the given file to know whether the file exists.
 *
 * @param {Workspace} workspace - The workspace.
 * @param {string} path - The path to the file, relative to the workspace root.
 * @returns {Promise<boolean>} True if the file exists, false otherwise.
 */
async function workspaceFileExists(workspace, path) {
  try {
    await getWorkspaceFile(workspace, path);
  } catch (error) {
    if ('code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  return true;
}

/**
 * Expect that the workspace has the given field, and that it is a non-null
 * value. If the field is not present, or is null, this will log an error, and
 * cause the constraint to fail.
 *
 * If a value is provided, this will also verify that the field is equal to the
 * given value.
 *
 * @param {Workspace} workspace - The workspace to check.
 * @param {string} fieldName - The field to check.
 * @param {unknown} [expectedValue] - The value to check.
 */
function expectWorkspaceField(workspace, fieldName, expectedValue = undefined) {
  const fieldValue = get(workspace.manifest, fieldName);

  if (expectedValue !== undefined && expectedValue !== null) {
    workspace.set(fieldName, expectedValue);
  } else if (expectedValue === null) {
    workspace.unset(fieldName);
  } else if (
    expectedValue === undefined &&
    (fieldValue === undefined || fieldValue === null)
  ) {
    workspace.error(`Missing required field "${fieldName}".`);
  }
}

/**
 * Expect that the workspace has the given field, and that it is an array-like
 * property containing the specified value. If the field is not present, is not
 * an array, or does not contain the value, this will log an error, and cause
 * the constraint to fail.
 *
 * @param {Workspace} workspace - The workspace to check.
 * @param {string} fieldName - The field to check.
 * @param {unknown} expectedValue - The value that should be contained in the array.
 */
function expectWorkspaceArrayField(
  workspace,
  fieldName,
  expectedValue = undefined,
) {
  let fieldValue = get(workspace.manifest, fieldName);

  if (expectedValue) {
    if (!Array.isArray(fieldValue)) {
      fieldValue = [];
    }

    if (!fieldValue.includes(expectedValue)) {
      fieldValue.push(expectedValue);
      workspace.set(fieldName, fieldValue);
    }
  } else if (fieldValue === undefined || fieldValue === null) {
    workspace.error(`Missing required field "${fieldName}".`);
  }
}

/**
 * Expect that the workspace has a description, and that it is a non-empty
 * string. If the description is not present, or is null, this will log an
 * error, and cause the constraint to fail.
 *
 * This will also verify that the description does not end with a period.
 *
 * @param {Workspace} workspace - The workspace to check.
 */
function expectWorkspaceDescription(workspace) {
  expectWorkspaceField(workspace, 'description');

  const { description } = workspace.manifest;

  if (typeof description !== 'string') {
    workspace.error(
      `Expected description to be a string, but got ${typeof description}.`,
    );
    return;
  }

  if (description === '') {
    workspace.error(`Expected description not to be an empty string.`);
    return;
  }

  if (description.endsWith('.')) {
    workspace.set('description', description.slice(0, -1));
  }
}

/**
 * Expect that the workspace has a license file, and that the `license` field is
 * set.
 *
 * @param {Workspace} workspace - The workspace to check.
 */
async function expectWorkspaceLicense(workspace) {
  if (
    !(await workspaceFileExists(workspace, 'LICENSE')) &&
    !(await workspaceFileExists(workspace, 'LICENSE.MIT0')) &&
    !(await workspaceFileExists(workspace, 'LICENSE.APACHE2'))
  ) {
    workspace.error('Could not find LICENSE file');
  }

  expectWorkspaceField(workspace, 'license');
}

/**
 * Expect that the workspace has a `types` and `default` field in the `exports`
 * object, and that they are in the correct order.
 *
 * @param {Workspace} workspace - The workspace to check.
 * @param {string} exportKey - The key to check.
 */
function expectCorrectWorkspaceExportsOrder(workspace, exportKey) {
  const exportValue = get(workspace.manifest, `exports["${exportKey}"]`);
  if (typeof exportValue === 'string') {
    return;
  }

  const importKeys = Object.keys(exportValue.import || {});
  if (importKeys[0] !== 'types') {
    workspace.error(
      `Expected exports["${exportKey}"].import to specify "types" as first key`,
    );
  }

  if (importKeys[1] !== 'default') {
    workspace.error(
      `Expected exports["${exportKey}"].import to specify "default" as second key`,
    );
  }

  const requireKeys = Object.keys(exportValue.require || {});
  if (requireKeys[0] !== 'types') {
    workspace.error(
      `Expected exports["${exportKey}"].require to specify "types" as first key`,
    );
  }

  if (requireKeys[1] !== 'default') {
    workspace.error(
      `Expected exports["${exportKey}"].require to specify "default" as second key`,
    );
  }
}

/**
 * Expect that the workspace has the correct extension for the given export
 * field.
 *
 * @param {Workspace} workspace - The workspace to check.
 * @param {string} key - The key to check.
 * @param {string} extension - The expected extension.
 */
function expectExportExtension(workspace, key, extension) {
  const exportValue = get(workspace.manifest, key);
  if (!exportValue.endsWith(extension)) {
    workspace.error(
      `Expected ${key} to end with ${extension}, but got ${exportValue}`,
    );
  }
}

/**
 * Expect that the workspace has exports set up correctly.
 *
 * @param {Workspace} workspace - The workspace to check.
 */
function expectCorrectWorkspaceExports(workspace) {
  const exportKeys = Object.keys(workspace.manifest.exports);

  if (!exportKeys.includes('.')) {
    workspace.error('Expected exports to include "."');
  }

  // All non-root packages must provide the location of the ESM-compatible
  // JavaScript entrypoint and its matching type declaration file.
  expectWorkspaceField(
    workspace,
    'exports["."].import.types',
    './dist/index.d.mts',
  );
  expectWorkspaceField(
    workspace,
    'exports["."].import.default',
    './dist/index.mjs',
  );

  // All non-root package must provide the location of the CommonJS-compatible
  // entrypoint and its matching type declaration file.
  expectWorkspaceField(
    workspace,
    'exports["."].require.types',
    './dist/index.d.cts',
  );
  expectWorkspaceField(
    workspace,
    'exports["."].require.default',
    './dist/index.cjs',
  );

  for (const exportKey of exportKeys) {
    const exportValue = get(workspace.manifest, `exports["${exportKey}"]`);
    if (typeof exportValue === 'string') {
      continue;
    }

    expectCorrectWorkspaceExportsOrder(workspace, exportKey);
    expectExportExtension(
      workspace,
      `exports["${exportKey}"].import.types`,
      '.mts',
    );

    expectExportExtension(
      workspace,
      `exports["${exportKey}"].import.default`,
      '.mjs',
    );

    expectExportExtension(
      workspace,
      `exports["${exportKey}"].require.types`,
      '.cts',
    );

    expectExportExtension(
      workspace,
      `exports["${exportKey}"].require.default`,
      '.cjs',
    );

    // Types should not be set in the export object directly, but rather in the
    // `import` and `require` subfields.
    expectWorkspaceField(workspace, `exports["${exportKey}"].types`, null);
  }

  expectWorkspaceField(workspace, 'main', './dist/index.cjs');
  expectWorkspaceField(workspace, 'types', './dist/index.d.cts');

  // All non-root packages must export a `package.json` file.
  expectWorkspaceField(
    workspace,
    'exports["./package.json"]',
    './package.json',
  );
}

/**
 * Expect that if the workspace package lists another workspace package within
 * `dependencies` or `devDependencies`, the version used within the dependency
 * is `workspace:^`.
 *
 * @param {Yarn} Yarn - The Yarn "global".
 * @param {Workspace} workspace - The workspace to check.
 */
function expectUpToDateWorkspaceDependenciesAndDevDependencies(
  Yarn,
  workspace,
) {
  for (const dependency of Yarn.dependencies({ workspace })) {
    const dependencyWorkspace = Yarn.workspace({ ident: dependency.ident });

    if (
      dependencyWorkspace !== null &&
      dependency.type !== 'peerDependencies'
    ) {
      dependency.update('workspace:^');
    }
  }
}

/**
 * Expect that if the workspace package lists another workspace package within
 * `peerDependencies`, the dependency range satisfies the current version of
 * that package.
 *
 * @param {Yarn} Yarn - The Yarn "global".
 * @param {Workspace} workspace - The workspace to check.
 */
function expectUpToDateWorkspacePeerDependencies(Yarn, workspace) {
  for (const dependency of Yarn.dependencies({ workspace })) {
    const dependencyWorkspace = Yarn.workspace({ ident: dependency.ident });

    if (
      dependencyWorkspace !== null &&
      dependency.type === 'peerDependencies'
    ) {
      expectWorkspaceField(
        workspace,
        `peerDependencies["${dependency.ident}"]`,
        `workspace:^`,
      );
    }
  }
}

/**
 * Expect that a workspace package does not list a dependency in both
 * `dependencies` and `devDependencies`.
 *
 * @param {Workspace} workspace - The workspace to check.
 * @param {Map<string, Map<DependencyType, Dependency>>} dependenciesByIdentAndType - Map of
 * dependency ident to dependency type and dependency.
 */
function expectDependenciesNotInBothProdAndDev(
  workspace,
  dependenciesByIdentAndType,
) {
  for (const [
    dependencyIdent,
    dependencyInstancesByType,
  ] of dependenciesByIdentAndType.entries()) {
    if (
      dependencyInstancesByType.size > 1 &&
      !dependencyInstancesByType.has('peerDependencies')
    ) {
      workspace.error(
        `\`${dependencyIdent}\` cannot be listed in both \`dependencies\` and \`devDependencies\``,
      );
    }
  }
}

/**
 * Expect that all version ranges in `dependencies` and `devDependencies` for
 * the same dependency across the entire monorepo are the same. As it is
 * impossible to compare NPM version ranges, let the user decide if there are
 * conflicts. (`peerDependencies` is a special case, and we handle that
 * particularly for workspace packages elsewhere).
 *
 * @param {Yarn} Yarn - The Yarn "global".
 */
function expectConsistentDependenciesAndDevDependencies(Yarn) {
  const nonPeerDependenciesByIdent = getNonPeerDependenciesByIdent(
    Yarn.dependencies(),
  );

  for (const [
    dependencyIdent,
    dependenciesByRange,
  ] of nonPeerDependenciesByIdent.entries()) {
    const dependencyRanges = [...dependenciesByRange.keys()].sort();
    if (dependenciesByRange.size > 1) {
      for (const dependencies of dependenciesByRange.values()) {
        for (const dependency of dependencies) {
          dependency.error(
            `Expected version range for ${dependencyIdent} (in ${
              dependency.type
            }) to be consistent across monorepo. Pick one: ${inspect(
              dependencyRanges,
            )}`,
          );
        }
      }
    }
  }
}
