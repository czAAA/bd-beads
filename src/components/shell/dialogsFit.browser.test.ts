import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, type Ref } from 'vue'
import { FIT_LOCALES, FIT_WIDTHS, fitProblems, mountAt } from '../../testUtils/browserFit'
import { provideAppShell, type AppShellContext } from '../../composables/shell/useAppShell'
import AppDialogs from './AppDialogs.vue'

// The confirm dialogs the shell opens from a flag, in every language at the layout's width edges (ticket 552; replaces
// the screens "Clear this Project", "Delete all Projects" and the like of e2e/visual/textFit.spec.ts).
const FLAGS = ['deleteAllConfirmOpen', 'resetProgressConfirmOpen', 'removeFrameConfirmOpen', 'replaceFrameConfirmOpen', 'removeAllColorsConfirmOpen', 'storageNoteOpen', 'shortcutsHelpOpen'] as const

let shell: AppShellContext
const Host = defineComponent({
  setup() {
    shell = provideAppShell()
    return () => h(AppDialogs)
  },
})

describe.each(FLAGS)('the dialog behind %s text fit', (flag) => {
  for (const locale of FIT_LOCALES) {
    for (const width of FIT_WIDTHS) {
      it(`fits its box in ${locale} at ${width}px`, async () => {
        await mountAt(Host, {}, { locale, width, text: false })
        ;(shell[flag] as Ref<boolean>).value = true
        await nextTick()
        expect(document.querySelector('.app-modal'), 'the dialog opened').not.toBeNull()
        expect(await fitProblems(`dialog ${flag}`, locale, width)).toEqual([])
      })
    }
  }
})
