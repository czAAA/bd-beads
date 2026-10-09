import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: ['dist/**', 'test-results/**', 'playwright-report/**'],
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
  // Module boundaries (ADR 0020): only services/ reaches outside the page's own memory, and only composables and the
  // app shell wire services in. Tests are exempt: they set up the browser state a service reads.
  {
    files: ['src/domain/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['vue', '**/services', '**/services/*', '**/composables/*', '**/components/*'], message: 'domain/ is pure: no Vue, services or UI (ADR 0020).' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'navigator', 'localStorage', 'fetch', 'document'].map((name) => ({
          name,
          message: 'domain/ is pure: browser access belongs in services/ (ADR 0020).',
        })),
      ],
    },
  },
  {
    files: ['src/rendering/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['vue', '**/services', '**/services/*'], message: 'rendering/ is free of Vue and services (ADR 0018, 0020).' }] },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/services', '**/services/*'], message: 'Components emit events or take what they need from props or the app shell (ADR 0020).' }] },
      ],
    },
  },
  // Feature subfolders (ADR 0020, amended by ADR 0024): components/ui/ holds the primitives every feature builds on, so
  // it imports from no feature folder, in components/ or composables/.
  {
    files: ['src/components/ui/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/services', '**/services/*'], message: 'Components emit events or take what they need from props or the app shell (ADR 0020).' },
            {
              group: ['canvas', 'tools', 'palette', 'export', 'import', 'project', 'shell', 'tour'].map((feature) => `**/${feature}/**`),
              message: 'components/ui/ imports from no feature folder (ADR 0024).',
            },
          ],
        },
      ],
    },
  },
)
