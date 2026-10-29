import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

// Ticket 472: a comment block is at most three lines. A longer one the maintainer approved says `approved-long` in it.
const MAX_COMMENT_LINES = 3
const maxCommentLines = {
  meta: { type: 'suggestion', schema: [], messages: { tooLong: 'Comment is {{n}} lines; keep it to {{max}} (ticket 472), or mark an approved one `approved-long`.' } },
  create(context) {
    const source = context.sourceCode
    const isDirective = (c) => /^\s*(eslint|@ts-|prettier|istanbul|v8|c8|vitest|jsdom|@vitest)/.test(c.value)
    const standalone = (c) => source.lines[c.loc.start.line - 1].slice(0, c.loc.start.column).trim() === ''
    return {
      'Program:exit'() {
        const groups = []
        for (const c of source.getAllComments()) {
          if (isDirective(c)) continue
          const last = groups[groups.length - 1]
          const prev = last && last[last.length - 1]
          if (c.type === 'Line' && standalone(c) && prev && prev.type === 'Line' && prev.loc.end.line + 1 === c.loc.start.line) last.push(c)
          else groups.push([c])
        }
        for (const g of groups) {
          const n = g[g.length - 1].loc.end.line - g[0].loc.start.line + 1
          if (n > MAX_COMMENT_LINES && !g.some((c) => c.value.includes('approved-long'))) {
            context.report({ loc: { start: g[0].loc.start, end: g[g.length - 1].loc.end }, messageId: 'tooLong', data: { n, max: MAX_COMMENT_LINES } })
          }
        }
      },
    }
  },
}

// Ticket 520: nothing raises a touch device's keyboard by itself. A text field is focused through TextField's `focus()`
// (an object argument with `select` or `asked`), never `.select()`, a native `.focus()` on something that looks like a
// field, or an input made in code or `contenteditable` (what the template lint of ticket 519 cannot see).
const TEXT_TAGS = /^(input|textarea)$/i
const fieldLooking = /input|field|textarea|getElementById/i
const noSelfRaisedKeyboard = {
  meta: { type: 'problem', schema: [], messages: { focus: 'Focus a text field with TextField\'s focus({ select | asked }), so a touch device\'s keyboard rises only on a tap (ticket 520).', make: 'Make a text field with <TextField> in a template, not in code or contenteditable (ticket 520).' } },
  create(context) {
    const source = context.sourceCode
    const tag = (node) => node && node.type === 'Literal' && typeof node.value === 'string' && TEXT_TAGS.test(node.value)
    const editable = (text) => /contenteditable/i.test(text)
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type === 'Identifier' && callee.name === 'h' && tag(node.arguments[0])) return context.report({ node, messageId: 'make' })
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return
        const name = callee.property.name
        if (name === 'createElement' && tag(node.arguments[0])) return context.report({ node, messageId: 'make' })
        if (name === 'select' && node.arguments.length === 0) return context.report({ node, messageId: 'focus' })
        if (name !== 'focus') return
        const first = node.arguments[0]
        const helper = first && first.type === 'ObjectExpression' && first.properties.some((p) => p.key && ['select', 'asked'].includes(p.key.name))
        if (!helper && fieldLooking.test(source.getText(callee.object))) context.report({ node, messageId: 'focus' })
      },
      Literal(node) {
        if (typeof node.value === 'string' && editable(node.value)) context.report({ node, messageId: 'make' })
      },
      TemplateElement(node) {
        if (editable(node.value.raw)) context.report({ node, messageId: 'make' })
      },
      Identifier(node) {
        if (/^contenteditable$/i.test(node.name)) context.report({ node, messageId: 'make' })
      },
    }
  },
}

// Ticket 0614: a translated string's blanks are filled by fillBlanks alone, so `.replace('{name}', …)` is refused, in a
// Vue template too.
const noHandFilledBlank = {
  meta: { type: 'problem', schema: [], messages: { fill: 'Fill a string\'s blanks with fillBlanks (domain/fillBlanks.ts), not by hand (ticket 0614).' } },
  create(context) {
    const blank = (node) => node && node.type === 'Literal' && typeof node.value === 'string' && /^\{\w+\}$/.test(node.value)
    const visitor = {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return
        if (/^replace(All)?$/.test(callee.property.name) && blank(node.arguments[0])) context.report({ node, messageId: 'fill' })
      },
    }
    const services = context.sourceCode.parserServices
    return services?.defineTemplateBodyVisitor ? services.defineTemplateBodyVisitor(visitor, visitor) : visitor
  },
}

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
    plugins: { local: { rules: { 'max-comment-lines': maxCommentLines, 'no-hand-filled-blank': noHandFilledBlank } } },
    rules: {
      'local/max-comment-lines': 'error',
      'local/no-hand-filled-blank': 'error',
      // This codebase's convention for a deliberately unused destructured
      // binding (e.g. dropping a legacy field via `const { x: _x, ...rest }`).
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // Toolbox predates this rule; renaming it is out of scope here.
      'vue/multi-word-component-names': ['error', { ignores: ['Toolbox'] }],
    },
  },
  // Ticket 520: no code raises a touch device's keyboard by itself. The allowlist is TextField (the focus helper) and the
  // runtime guard (touchFocusGuard, which has to name text fields); tests build their own fields. The managers of focus
  // (AppModal, AppPanel, menus, roving focus) focus buttons and containers, which the rule does not match by name.
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts', 'src/testSetup.ts', 'src/testUtils/**', 'src/components/ui/form/TextField.vue', 'src/services/touchFocusGuard.ts', 'src/composables/ui/touchKeyboard.ts'],
    plugins: { keyboard: { rules: { 'no-self-raised-keyboard': noSelfRaisedKeyboard } } },
    rules: { 'keyboard/no-self-raised-keyboard': 'error' },
  },
  // Every hotkey chip is drawn by KeyChip (ticket 438), and every text field by TextField (ticket 519), so the keyboard
  // handling lives in one place. `vue/no-restricted-syntax` is one rule: a later block replaces an earlier one for the
  // files it matches, so each exemption lists the selectors that still apply to its files.
  ...(() => {
    const kbd = { selector: "VElement[name='kbd']", message: 'Draw a key chip with <KeyChip> (ticket 438).' };
    const textEntry = {
      selector: "VElement[name=/^(input|textarea)$/]:not(:has(VAttribute[directive=false][key.name='type'][value.value=/^(file|range)$/]))",
      message: 'Use <TextField> for text entry (ticket 519).',
    };
    const block = (ignores, selectors) => ({ files: ['src/**/*.vue'], ignores, rules: { 'vue/no-restricted-syntax': ['error', ...selectors] } });
    // A range input (QualitySlider, ticket 576) raises no keyboard either.
    // The file inputs open a picker, not a keyboard, so only these two components may hold a bare <input type="file">.
    const fileInputs = ['src/components/ui/form/FileButton.vue', 'src/components/import/ProjectImport.vue'];
    return [
      block(['src/components/ui/KeyChip.vue', 'src/components/ui/form/TextField.vue'], [kbd, textEntry]),
      { files: ['src/components/ui/KeyChip.vue'], rules: { 'vue/no-restricted-syntax': ['error', textEntry] } },
      { files: ['src/components/ui/form/TextField.vue'], rules: { 'vue/no-restricted-syntax': ['error', kbd] } },
      ...fileInputs.map((f) => ({ files: [f], rules: { 'vue/no-restricted-syntax': ['error', kbd] } })),
    ];
  })(),
  // `no-restricted-syntax` is one rule: a later block replaces an earlier one for the files it matches, so each
  // exemption lists the selectors that still apply to its files.
  ...(() => {
    // One overlay registry (ticket 449, ADR 0061): a press outside an overlay is handled by useOverlayLayer alone, so no
    // other code listens to raw document/window pointerdown, mousedown or click.
    const press = {
      selector:
        "CallExpression[callee.property.name=/^(add|remove)EventListener$/][callee.object.name=/^(document|window)$/][arguments.0.value=/^(pointerdown|mousedown|click)$/]",
      message: 'A press outside an overlay goes through useOverlayLayer (ticket 449, ADR 0061); only canvas gesture code listens to raw presses.',
    };
    // A Technique is named only in its entry (tickets 506, 0611): no other code writes its id as a value or a key, and
    // the registries that use one (Frame shapes, Starters, the Homepage) name it as their entry's `technique` or in its
    // `techniques` list.
    const ids = 'loom|peyote|brick';
    const message = 'Read the Technique from its entry in domain/weave.ts (TECHNIQUES, DEFAULT_TECHNIQUE, describeWeave) instead of writing its id (tickets 506, 0611).';
    const techniqueValue = { selector: `Literal[value=/^(${ids})$/]`, message };
    const techniqueKey = { selector: `Property > Identifier.key[name=/^(${ids})$/]`, message };
    const namedTechnique = {
      selector: `Literal[value=/^(${ids})$/]:not(Property[key.name='technique'] > Literal.value):not(Property[key.name='techniques'] > ArrayExpression > Literal)`,
      message,
    };
    // The canvas gestures (pan, pinch, page-zoom lock, pen mode) and the click swallowers listen to raw presses.
    const gestures = [
      'src/composables/ui/useOverlayLayer.ts',
      'src/composables/ui/swallowNextClick.ts',
      'src/composables/canvas/useSpaceDragPan.ts',
      'src/composables/canvas/usePinchPan.ts',
      'src/composables/shell/usePageZoomLock.ts',
      'src/composables/shell/usePenInputMode.ts',
      'src/composables/tools/useToolPillDrag.ts',
    ];
    const registries = ['src/domain/frameShape.ts', 'src/domain/starters.ts', 'src/homepage/**'];
    const block = (files, selectors) => ({
      files,
      ignores: ['**/*.test.ts', 'src/testSetup.ts', 'src/testUtils/**'],
      rules: { 'no-restricted-syntax': ['error', ...selectors] },
    });
    return [
      block(['src/**/*.{ts,vue}'], [press, techniqueValue, techniqueKey]),
      block(gestures, [techniqueValue, techniqueKey]),
      block(['src/domain/weave.ts', 'src/i18n/**'], [press]),
      block(registries, [press, namedTechnique, techniqueKey]),
    ];
  })(),
  // The backend Worker (ticket 71) is its own module with its own runtime: the app reaches it over /api, never by
  // import. Placed before the folder rules below, which replace it for their files.
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/worker', '**/worker/**'], message: 'The Worker is a separate module; the app calls it over /api (ticket 71).' }] },
      ],
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
  // Feature subfolders (ADR 0020): components/ui/ holds the primitives every feature builds on, so
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
              group: ['canvas', 'tools', 'palette', 'export', 'import', 'project', 'shell'].map((feature) => `**/${feature}/**`),
              message: 'components/ui/ imports from no feature folder (ADR 0020).',
            },
          ],
        },
      ],
    },
  },
)
