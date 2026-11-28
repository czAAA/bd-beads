import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { mountAt, type FitLocale } from '../../testUtils/browserFit'
import { marginSheetHost } from '../../testUtils/marginSheetHost'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import NewProjectForm from '../project/NewProjectForm.vue'

// A picker's list opens against its button, also the first time (ticket 0681): a list laid out in its row for a moment
// pushed the button aside (the margin sheet's title block, then at its bottom-right corner, moved its pencil left) and
// the list was left where the button had been.

/** The Menu card's gap between a button and its list. */
const GAP = 4

// The margin chip is pushed only by the longest Technique names; a New Project row is pushed in any language. The
// sheet at 125%, where the chip stands far enough from the screen's left edge for its list to end at the button's right
// (at 100% the list opens from its left instead, ticket 1213).
const CASES: [name: string, host: Component, picker: string, locale: FitLocale][] = [
  ['the margin Technique chip', marginSheetHost(1.25), 'margin-technique-picker', 'longest'],
  ['New Project Technique', NewProjectForm, 'new-project-technique', 'en'],
]

describe('PanelPicker', () => {
  for (const [name, host, picker, locale] of CASES) {
    it(`opens the list of ${name} against its button the first time`, async () => {
      const { root } = await mountAt(host, {}, { locale, width: 1280 })
      const button = root.querySelector<HTMLElement>(`[data-testid="${picker}"] button[aria-haspopup]`)!
      const before = button.getBoundingClientRect()
      button.click()
      await settleForMeasuring()
      const list = root.querySelector<HTMLElement>('[role="menu"]')!.getBoundingClientRect()
      const after = button.getBoundingClientRect()
      expect({ buttonMoved: Math.round(after.left - before.left), right: Math.round(list.right), top: Math.round(list.top) }).toEqual({
        buttonMoved: 0,
        right: Math.round(after.right),
        top: Math.round(after.bottom + GAP),
      })
    })
  }
})
