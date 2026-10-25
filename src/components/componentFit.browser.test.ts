import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { FIT_LOCALES, FIT_WIDTHS, misfitsNow, mountAt } from '../testUtils/browserFit'
import MenuPanel from './shell/MenuPanel.vue'
import ProgressBar from './canvas/ProgressBar.vue'
import ToolPill from './tools/ToolPill.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createProject, toggleRowDirection } from '../domain/project'

// Components with a fixed-size box, mounted in a real browser in every language at the layout's width edges, must keep
// their text inside the box (ticket 552; replaces the screens of e2e/visual/textFit.spec.ts that only they lived on).
const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const project = createProject({ technique: 'loom', beadId: cubeBead.id, size: { width: 15, height: 30, unit: 'mm' } })

const CASES: [string, Component, Record<string, unknown>][] = [
  ['MenuPanel', MenuPanel, { projects: [project], penSeen: true }],
  ['ToolPill', ToolPill, { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false, hasClipboard: true, colorHex: '#e63746', colorName: 'Red' }],
  ['ProgressBar by rows', ProgressBar, { project }],
  ['ProgressBar by columns', ProgressBar, { project: toggleRowDirection(project) }],
]

describe.each(CASES)('%s text fit', (_name, component, props) => {
  for (const locale of FIT_LOCALES) {
    for (const width of FIT_WIDTHS) {
      it(`fits its box in ${locale} at ${width}px`, async () => {
        const mounted = await mountAt(component, props, { locale, width })
        expect(await misfitsNow()).toEqual([])
        mounted.unmount()
      })
    }
  }
})
