module.exports = {
  root: true,

  extends: ['@metamask/eslint-config'],

  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },

  env: {
    'shared-node-browser': true,
  },

  rules: {
    // This prevents importing Node.js builtins. We currently use them in
    // our codebase, so this rule is disabled. This rule should be disabled
    // in `@metamask/eslint-config-nodejs` in the future.
    'import-x/no-nodejs-modules': 'off',

    // This prevents using the `console.log` and similar functions. All logging
    // should be done through the module logger, or `logError` function in
    // `@metamask/snaps-utils`.
    'no-console': 'error',

    // This prevents using Node.js and/or browser specific globals. We
    // currently use both in our codebase, so this rule is disabled.
    'no-restricted-globals': 'off',

    // This rule disallows the `private` modifier on class fields, but we
    // use it in some places. It also disables function expressions, but this
    // triggers for class methods as well.
    'no-restricted-syntax': 'off',
  },

  overrides: [
    {
      files: ['**/*.js'],
      extends: ['@metamask/eslint-config-nodejs'],

      parserOptions: {
        ecmaVersion: 2020,
      },

      rules: {
        // This prevents using Node.js and/or browser specific globals. We
        // currently use both in our codebase, so this rule is disabled.
        'no-restricted-globals': 'off',
      },
    },

    {
      files: ['**/*.ts', '**/*.tsx'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        // This rule disallows the `private` modifier on class fields, but we
        // use it in some places. It also disables function expressions, but this
        // triggers for class methods as well.
        'no-restricted-syntax': 'off',

        // Copied from `@metamask/eslint-config-typescript` but modified to
        // allow importing with PascalCase or camelCase again.
        // TODO: Upstream this change.
        '@typescript-eslint/naming-convention': [
          'error',
          {
            selector: 'default',
            format: ['camelCase'],
            leadingUnderscore: 'allow',
            trailingUnderscore: 'forbid',
          },
          {
            selector: 'enumMember',
            format: ['PascalCase'],
          },
          {
            selector: 'import',
            format: ['camelCase', 'PascalCase'],
          },
          {
            selector: 'interface',
            format: ['PascalCase'],
            custom: {
              regex: '^I[A-Z]',
              match: false,
            },
          },
          {
            selector: 'objectLiteralMethod',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          },
          {
            selector: 'objectLiteralProperty',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          },
          {
            selector: 'typeLike',
            format: ['PascalCase'],
          },
          {
            selector: 'typeParameter',
            format: ['PascalCase'],
            custom: {
              regex: '^.{3,}',
              match: true,
            },
          },
          {
            selector: 'variable',
            format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
            leadingUnderscore: 'allow',
          },
          {
            selector: 'parameter',
            format: ['camelCase', 'PascalCase'],
            leadingUnderscore: 'allow',
          },
          {
            selector: [
              'classProperty',
              'objectLiteralProperty',
              'typeProperty',
              'classMethod',
              'objectLiteralMethod',
              'typeMethod',
              'accessor',
              'enumMember',
            ],
            format: null,
            modifiers: ['requiresQuotes'],
          },
        ],

        // Don't require explicit return types.
        // TODO: Upstream this change(?).
        '@typescript-eslint/explicit-function-return-type': 'off',

        // These rules cause a lot of false positives.
        // TODO: Investigate why this is needed.
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/no-redundant-type-constituents': 'off',

        // This allows importing the `Text` JSX component.
        '@typescript-eslint/no-shadow': [
          'error',
          {
            allow: ['Text'],
          },
        ],

        // Allow `||` in conditional tests and mixed logical expressions.
        // TODO: Upstream this change.
        '@typescript-eslint/prefer-nullish-coalescing': [
          'error',
          {
            ignoreConditionalTests: true,
            ignoreMixedLogicalExpressions: true,
          },
        ],

        // Without the `allowAny` option, this rule causes a lot of false
        // positives.
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          {
            allowAny: true,
            allowBoolean: true,
            allowNumber: true,
          },
        ],

        // This is handled by the `@typescript-eslint/no-empty-function` rule.
        // TODO: Upstream this change.
        'no-empty-function': 'off',
      },
    },

    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test.js'],
      extends: ['@metamask/eslint-config-jest'],
      rules: {
        '@typescript-eslint/no-shadow': [
          'error',
          { allow: ['describe', 'expect', 'it'] },
        ],
        '@typescript-eslint/unbound-method': 'off',
        'no-console': 'off',
      },
    },
  ],

  ignorePatterns: [
    '!.prettierrc.js',
    '**/!.eslintrc.js',
    '**/dist*/',
    'packages/**',
  ],
};
