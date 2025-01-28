# Contributing to the monorepo

## Getting started

- Install [Node.js](https://nodejs.org) version 16.
  - If you're using [NVM](https://github.com/creationix/nvm#installation)
    (recommended), `nvm use` will ensure that the right version is installed.
- Install [Yarn v3](https://yarnpkg.com/getting-started/install).
- Run `yarn install` to install dependencies and run any required post-install
  scripts.

## Testing

- Run `yarn workspace <workspaceName> run test` to run all tests for a package.
- Run `yarn workspace <workspaceName> run jest --no-coverage <file>` to run a
  test file within the context of a package.
- Run `yarn test` to run tests for all packages.

> **Note**
>
> `workspaceName` in these commands is the `name` field within a package's
> `package.json`, e.g., `@metamask/snaps-controllers`, not the directory where
> it is located, e.g., `packages/snaps-controllers`.

## Linting

Run `yarn lint` to lint all files and show possible violations.

Run `yarn lint:fix` to fix any automatically fixable violations.

## Performing operations across the monorepo

This repository relies on Yarn's [workspaces feature](https://yarnpkg.com/features/workspaces)
to provide a way to work with packages individually and collectively. Refer to
the documentation for the following Yarn commands for usage instructions:

- [`yarn workspace`](https://yarnpkg.com/cli/workspace)
- [`yarn workspaces foreach`](https://yarnpkg.com/cli/workspaces/foreach)

## Using packages in other projects during development/testing

When developing changes to packages within this repository that a different
project depends upon, you may wish to load those changes into the project and
test them locally or in CI before publishing proper releases of those packages.
To solve that problem, this repository provides a mechanism to publish "preview"
versions of packages to GitHub Package Registry. These versions can then be used
in the project like any other version, provided the project is configured to use
that registry.

### Publishing preview builds as a MetaMask contributor

If you are a member of the MetaMask organization, you can create branches
directly on this repository rather than using a fork. This allows you to use our
preview build GitHub Action.

Post a comment on the PR with the text `@metamaskbot publish-preview` (This
triggers the `publish-preview` GitHub action). After a few minutes, you will see
a new comment indicating that all packages have been published with the format
`<package name>-<commit id>`.

### Publishing preview builds as an independent contributor

If you're a contributor and you've forked this repository, you can create
preview versions for a branch by following these steps:

1. Open the `package.json` for each package that you want to publish and change
   the scope in the name from `@metamask` to `@<your GitHub username>`.
2. From your local fork of the repository, run
   `yarn prepare-preview-builds "$(git rev-parse --short HEAD)" && yarn build && yarn publish-previews` to generate preview versions for all packages based
   on the current branch and publish them to GitHub Package Registry.

   - Take note of the version that is published; it should look like `1.2.3 -e2df9b4` instead of `1.2.3`.

### Using preview builds

> **Warning**
>
> There is a known problem with the preview build workflow. It relies upon you
> having a local cache of any non-preview `@metamask/`-scoped packages.
>
> If you encounter problems installing non-preview `@metamask/`-scoped packages
> when using this workflow, you can work around the problem by first installing
> dependencies without preview builds enabled (e.g. by temporarily removing the
> `.npmrc` or unsetting the required environment variables) to install the
> missing packages. Once they are installed, preview build installations should
> work (the non-preview `@metamask/`-scoped packages will be found in your local
> cache).
>
> See [issue #1075](https://github.com/MetaMask/core/issues/1075) for more
> details.

Preview builds should automatically work in CI on the MetaMask extension and
MetaMask mobile repositories, as long as the PR is in draft.

To use preview builds locally, follow these steps:

1. Navigate to your settings within GitHub and
   [create a classic access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-personal-access-token-classic).
   Make sure to give this token the `read:packages` scope.

2. Follow these steps in the project using the preview builds:

- **Yarn 1 (classic) or NPM**

  Add the following in `.npmrc`

  ```
  @metamask:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=<your personal access token>
  ```

- **Yarn >= 2 (berry):**

  Ensure that the project `.yarnrc.yml` file has the following contents:

  ```yml
  npmRegistries:
    'https://npm.pkg.github.com':
      npmAlwaysAuth: true
      npmAuthToken: '${GITHUB_NPM_TOKEN-}'

  npmScopes:
    metamask:
      npmRegistryServer: '${METAMASK_NPM_REGISTRY:-https://registry.yarnpkg.com}'
  ```

  The `METAMASK_NPM_REGISTRY` environment variable lets you control which
  registry is used for `@metamask`-scoped packages. Set this environment
  variable to `https://npm.pkg.github.com` to use preview builds. The
  `GITHUB_NPM_TOKEN` environment variable is where your token is set (the one
  created in step 1).

  For example, in Bash or ZSH, you can set both of these environment variables
  when installing dependencies:

  ```bash
  GITHUB_NPM_TOKEN=<your personal access token> METAMASK_NPM_REGISTRY=https://npm.pkg.github.com yarn install
  ```

  - It's recommended to use your machine's local keychain to store the token
    and retrieve it from there. For example on macOS, you can use:
    ```bash
    GITHUB_NPM_TOKEN=$(security find-generic-password -s 'GitHub NPM Token' -w) METAMASK_NPM_REGISTRY=https://npm.pkg.github.com yarn install
    ```

3. Update `package.json` with the new preview build versions

   - Each preview build package should have a version matching (e.g.,
     `1.2.3-e2df9b4` instead of `~1.2.3`), then run `yarn install`.

4. Repeat step 3 each time you publish new preview builds.

## Releasing

The [`create-release-branch`](https://github.com/MetaMask/create-release-branch)
tool and [`action-publish-release`](https://github.com/MetaMask/action-publish-release)
GitHub action are used to automate the release process.

1. **Create a release branch.**

   Run `yarn create-release-branch`. This tool generates a file and opens it in
   your editor, where you can specify which packages you want to include in
   the next release and which versions they should receive. Instructions are
   provided for you at the top; read them and update the file accordingly.

   When you're ready to continue, save and close the file, and run the tool
   again. This time, it will create a new branch for the release.

2. **Update changelogs for relevant packages.**

   At this point, you will be on a new release branch, and a new section will
   have been added to the changelog of each package you specified in the
   previous step.

   For each changelog, review the new section and make the appropriate changes:

- Move each entry into the appropriate category (review the
  ["Keep a Changelog"](https://keepachangelog.com/en/1.0.0/#types) spec for
  the full list of categories and the correct ordering of all categories).
- Remove any changelog entries that don't affect consumers of the package
  (e.g., lockfile changes or development environment changes). Exceptions may
  be made for changes that might be of interest despite not having an effect
  upon the published package (e.g., major test improvements, security
  improvements, improved documentation, etc.).
- Reword changelog entries to explain changes in terms that users of the
  package will understand (e.g., avoid referencing internal
  variables/concepts).
- Consolidate related changes into one change entry if it makes it easier to
  comprehend.

  Run `yarn changelog:validates` to check that all changelogs are correctly
  formatted.

  Commit and push the branch.

3. **Submit a pull request for the release branch so that it can be reviewed and
   tested.**

   Make sure the title of the pull request follows the pattern
   "Release \<new version\>".

   If changes are made to the base branch, the release branch will need to be
   updated with these changes, and review/QA will need to restart again. As such,
   it's probably best to avoid merging other PRs into the base branch while
   review is underway.

4. **"Squash & Merge" the release.**

   This step triggers the
   [`publish-release` GitHub action](https://github.com/MetaMask/action-publish-release)
   workflow to tag the final release commit and publish the release on GitHub.

   Pay attention to the box you see when you press the green button and ensure
   that the final name of the commit follows the pattern
   "Release \<new version\>".

5. **Publish the release on NPM.**

   The `publish-release` GitHub Action workflow runs the `publish-npm` job,
   which publishes relevant packages to NPM. It requires approval from the
   [`npm-publishers`](https://github.com/orgs/MetaMask/teams/npm-publishers)
   team to complete. If you're not on the team, ask a member to approve it for
   you; otherwise, approve the job.

   Once the `publish-npm` job has finished,
   [check NPM](https://npms.io/search?q=scope%3Ametamask) to verify that all
   relevant packages have been published.
