import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: ['dist/**'],
  },
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      // This codebase's convention for a deliberately unused destructured
      // binding (e.g. dropping a legacy field via `const { x: _x, ...rest }`).
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // Toolbox predates this rule; renaming it is out of scope here.
      'vue/multi-word-component-names': ['error', { ignores: ['Toolbox'] }],
    },
  },
)
