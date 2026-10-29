import { defineComponent, h, type Component } from 'vue'
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { mountAt, type FitLocale } from '../../testUtils/browserFit'
import { withFields } from '../../testUtils/flatFields'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import MarginSheet from '../canvas/MarginSheet.vue'
import NewProjectForm from '../project/NewProjectForm.vue'

// A picker's list opens against its button, also the first time (ticket 0681): a list laid out in its row for a moment
// pushed the button aside (the margin title block sits in the sheet's bottom-right corner, so its pencil went left) and
// the list was left where the button had been.
const bead = BEAD_CATALOG.find((candidate) => candidate.id === 'toho/cube/1.5mm')!
const project: Project = withFields(createProject({ technique: 'loom', beadId: bead.id, name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), {
  makerName: 'Ada',
  frame: { row: 0, column: 0, rows: 8, columns: 30, technique: 'loom', beads: {}, name: 'Sun band' },
})
const anchor = { box: { left: 65, top: 65, width: 554, height: 158 }, sheet: { left: 0, top: 0, width: 684, height: 288 }, band: 72, viewport: { width: 684, height: 288 } }
const SheetHost = defineComponent({
  setup: () => () => h('div', { style: { position: 'relative', width: '100%', height: '320px' } }, [h(MarginSheet, { project, anchor, editing: false, pressing: false })]),
})

/** The Menu card's gap between a button and its list. */
const GAP = 4

// The margin pencil is pushed only by the longest Technique names; a New Project row is pushed in any language.
const CASES: [name: string, host: Component, picker: string, locale: FitLocale][] = [
  ['the margin Technique pencil', SheetHost, 'margin-technique-picker', 'longest'],
  ['New Project Technique', NewProjectForm, 'new-project-technique', 'en'],
]

describe('PanelPicker', () => {
  for (const [name, host, picker, locale] of CASES) {
    it(`opens the list of ${name} against its button the first time`, async () => {
      const { root } = await mountAt(host, {}, { locale, width: 1280 })
      const button = root.querySelector<HTMLElement>(`[data-testid="${picker}"] button`)!
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
