import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, type Ref } from 'vue'
import { FIT_LOCALES, FIT_WIDTHS, fitProblems, mountAt, problemsAcrossWidths } from '../../testUtils/browserFit'
import { provideAppShell, type AppShellContext } from '../../composables/shell/useAppShell'
import { createProject } from '../../domain/project'
import { saveProjects } from '../../services/libraryStore'
import AppDialogs from './AppDialogs.vue'

// The confirm dialogs the shell opens from a flag, in every language at the layout's width edges (ticket 552).
const FLAGS = ['deleteAllConfirmOpen', 'resetProgressConfirmOpen', 'removeFrameConfirmOpen', 'replaceFrameConfirmOpen', 'removeAllColorsConfirmOpen', 'storageNoteOpen', 'shortcutsHelpOpen'] as const

// The dialogs that name a Project: two are saved, so the open one has another to switch to and to remove.
const moth = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
const fox = { ...createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Fox', size: { width: 12, height: 12, unit: 'beads' } }), id: 'fox' }
const WITH_PROJECT: [string, (shell: AppShellContext) => void][] = [
  ['duplicating', (shell) => (shell.duplicating.value = 'Moth copy')],
  ['deleting', (shell) => (shell.deleting.value = true)],
  ['deletingAll', (shell) => (shell.deletingAll.value = true)],
  ['naming', (shell) => (shell.naming.value = { at: { row: 0, column: 0 }, name: 'Moth' })],
  ['pendingRemove', (shell) => (shell.pendingRemove.value = fox)],
  ['pendingSwitch', (shell) => (shell.pendingSwitch.value = fox)],
  ['pendingImport', (shell) => (shell.pendingImport.value = [fox])],
]

let shell: AppShellContext
const Host = defineComponent({
  setup() {
    shell = provideAppShell()
    return () => h(AppDialogs)
  },
})

describe.each(FLAGS)('the dialog behind %s text fit', (flag) => {
  for (const locale of FIT_LOCALES) {
    it(`fits its box in ${locale} at ${FIT_WIDTHS.join(', ')}px`, async () => {
      await mountAt(Host, {}, { locale, width: FIT_WIDTHS[0], text: false })
      ;(shell[flag] as Ref<boolean>).value = true
      await nextTick()
      expect(document.querySelector('.app-modal'), 'the dialog opened').not.toBeNull()
      expect(await problemsAcrossWidths(FIT_WIDTHS, (width) => fitProblems(`dialog ${flag}`, locale, width))).toEqual({})
    })
  }
})

describe.each(WITH_PROJECT)('the dialog behind %s text fit', (flag, open) => {
  for (const locale of FIT_LOCALES) {
    it(`fits its box in ${locale} at ${FIT_WIDTHS.join(', ')}px`, async () => {
      saveProjects([moth, fox])
      await mountAt(Host, {}, { locale, width: FIT_WIDTHS[0], text: false })
      open(shell)
      await nextTick()
      expect(document.querySelector('.app-modal'), 'the dialog opened').not.toBeNull()
      expect(await problemsAcrossWidths(FIT_WIDTHS, (width) => fitProblems(`dialog ${flag}`, locale, width))).toEqual({})
    })
  }
})
