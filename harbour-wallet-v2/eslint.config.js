import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public-production/**', 'releases/**', 'config/**', 'demo/**', '.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'gateway/**/*.ts'],
    plugins: { 'react-hooks': reactHooks, 'unused-imports': unusedImports },
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker, chrome: 'readonly' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-console': 'error', // use core/logger (redacts secrets)
      'no-debugger': 'error', 'no-eval': 'error', 'no-implied-eval': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      // Deliberate: input sanitizers strip control and zero-width characters, and several effects intentionally omit unstable deps.
      'no-control-regex': 'off', 'no-irregular-whitespace': 'off', 'no-useless-escape': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }], 'no-constant-condition': ['error', { checkLoops: false }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-this-alias': 'off',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  { files: ['src/background/modules/**/*.ts'], rules: { '@typescript-eslint/no-unused-vars': 'off' } }, // handler modules destructure the shared ctx ({ core, vault, wallet, sender }) in every handler
  { files: ['gateway/**/*.ts'], rules: { 'no-console': 'off' } }, // Workers have no other log sink (messages are error names only)
  { files: ['scripts/**/*.mjs', 'test/**/*.{js,mjs}', 'eslint.config.js'], languageOptions: { globals: globals.node }, rules: { 'no-control-regex': 'off', 'no-irregular-whitespace': 'off', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-constant-condition': 'off', 'no-constant-binary-expression': 'off', 'no-useless-escape': 'off', '@typescript-eslint/no-unused-expressions': 'off', '@typescript-eslint/no-unused-vars': 'off' } },
);
