import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  ignores: ['node_modules', '.*'],
}).prepend(eslint.configs.recommended, tseslint.configs.recommended);
