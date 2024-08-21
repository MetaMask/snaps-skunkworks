module.exports = {
  extends: ['../../.eslintrc.js'],

  parserOptions: {
    tsconfigRootDir: __dirname,
  },

  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['@metamask/eslint-config-nodejs'],
      globals: {
        snaps: true,
      },

      rules: {
        'n/no-sync': 'off',
      },
    },

    {
      files: ['src/main.ts'],
      rules: {
        'n/shebang': 'off',
      },
    },
  ],
};
