import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { FIT_LOCALES, FIT_WIDTHS, fitProblems, mountAt, problemsAcrossWidths } from '../../testUtils/browserFit'
import { provideAppShell } from '../../composables/shell/useAppShell'
import type { Dialogs } from '../../composables/shell/useDialogs'
import { createProject } from '../../domain/project'
import { saveProjects } from '../../services/libraryStore'
import AppDialogs from './AppDialogs.vue'

type DialogId = Parameters<Dialogs['flag']>[0]

// The shell's dialogs that ask about nothing, opened through the registry, in every language at the layout's width
// edges (ticket 552).
const FLAGS: DialogId[] = ['delete-all', 'reset-progress', 'remove-frame', 'replace-frame', 'remove-all-colors', 'keep-note', 'shortcuts']

// The dialogs that name a Project: two are saved, so the open one has another to switch to and to remove.
const moth = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
const fox = { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Fox', size: { width: 12, height: 12, unit: 'beads' } }), id: 'fox' }
const WITH_PROJECT: [DialogId, unknown][] = [
  ['duplicate-project', 'Moth copy'],
  ['delete-project', true],
  ['delete-all-projects', true],
  ['name-piece', { at: { row: 0, column: 0 }, name: 'Moth' }],
  ['remove-project', fox],
  ['switch-project', fox],
  ['import-switch', [fox]],
]

let dialogs: Dialogs
const Host = defineComponent({
  setup() {
    dialogs = provideAppShell().dialogRegistry
    return () => h(AppDialogs)
  },
})

describe.each(FLAGS)('the dialog behind %s text fit', (flag) => {
  for (const locale of FIT_LOCALES) {
    it(`fits its box in ${locale} at ${FIT_WIDTHS.join(', ')}px`, async () => {
      await mountAt(Host, {}, { locale, width: FIT_WIDTHS[0], text: false })
      dialogs.flag(flag).value = true
      await nextTick()
      expect(document.querySelector('.app-modal'), 'the dialog opened').not.toBeNull()
      expect(await problemsAcrossWidths(FIT_WIDTHS, (width) => fitProblems(`dialog ${flag}`, locale, width))).toEqual({})
    })
  }
})

describe.each(WITH_PROJECT)('the dialog behind %s text fit', (flag, question) => {
  for (const locale of FIT_LOCALES) {
    it(`fits its box in ${locale} at ${FIT_WIDTHS.join(', ')}px`, async () => {
      saveProjects([moth, fox])
      await mountAt(Host, {}, { locale, width: FIT_WIDTHS[0], text: false })
      dialogs.question(flag).value = question
      await nextTick()
      expect(document.querySelector('.app-modal'), 'the dialog opened').not.toBeNull()
      expect(await problemsAcrossWidths(FIT_WIDTHS, (width) => fitProblems(`dialog ${flag}`, locale, width))).toEqual({})
    })
  }
})
