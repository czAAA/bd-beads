import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { createProject } from '../../domain/createProject'
import { createPalette, defaultPaletteIds } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { moveToRow } from '../../domain/rowProgress'
import { frameOutsetPx } from '../../rendering/rulerScale'
import { FIT_LOCALES, mountAt } from '../../testUtils/browserFit'
import { paintAt } from '../../testUtils/layers'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import MarginSheet from './MarginSheet.vue'
import { withFields } from '../../testUtils/flatFields'

// The margin sheet keeps its controls' size as the zoom grows and shrinks its band, so it changes form (ticket 0658):
// at each zoom, and on a narrow Frame, nothing of the Frame stands outside its sheet, over its beads, or over another
// control. Measured in the page, in English and in the longest text of every language.

const zoom = ref(1)
const columns = ref(40)

/** Where a loom Frame of `columns` × 11 and its sheet are at a zoom, as the surface reports them: beads of 20px at
 * 100%, its line out from them, its sheet 4 beads round them. */
function anchorAt(at: number, across: number): FrameAnchor {
  const band = 80 * at
  const outset = frameOutsetPx(at)
  const beads = { width: across * 20 * at, height: 11 * 20 * at }
  return {
    box: { left: band - outset, top: band - outset, width: beads.width + 2 * outset, height: beads.height + 2 * outset },
    sheet: { left: 0, top: 0, width: beads.width + 2 * band, height: beads.height + 2 * band },
    band,
    viewport: { width: 1280, height: 800 },
  }
}

function projectOf(across: number): Project {
  const bare: Project = withFields(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 12, height: 12, unit: 'beads' } }), {
makerName: 'Ada',
    frame: { row: 0, column: 0, rows: 11, columns: across, technique: 'loom', beads: {}, name: 'Sun band' },
})
  const painted = createPalette(defaultPaletteIds()).colors.map((color) => color.hex).slice(0, across).reduce((drawn, color, column) => paintAt(drawn, [{ row: 0, column }], color), bare)
  return moveToRow(painted, 0)
}

const Host = defineComponent({
  setup() {
    return () => h('div', { style: { position: 'relative', margin: '16px' } }, [h(MarginSheet, { project: projectOf(columns.value), anchor: anchorAt(zoom.value, columns.value), editing: false, pressing: false })])
  },
})

/** Each form steps down a frame at a time where it does not fit: wait until the sheet holds still. */
async function settled(root: HTMLElement): Promise<void> {
  let before = ''
  for (let tries = 0; tries < 8; tries++) {
    await settleForMeasuring()
    const now = root.innerHTML
    if (now === before) return
    before = now
  }
}

const inside = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5
const overlap = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5

/** What is wrong with the sheet as laid out now: a control outside the sheet, over the Frame's line or beads, or over
 * another. */
function problems(root: HTMLElement): string[] {
  const sheet = root.querySelector<HTMLElement>('[data-testid="margin-sheet"]')!.getBoundingClientRect()
  const { box } = anchorAt(zoom.value, columns.value)
  const line = new DOMRect(sheet.left + box.left, sheet.top + box.top, box.width, box.height)
  const band = [...root.querySelectorAll<HTMLElement>('[data-testid="margin-band"] :is(button, [role="progressbar"], .row-progress__counter)')]
  const title = root.querySelector<HTMLElement>('[data-testid="margin-title"] > *')
  const parts = [...band, ...(title ? [title] : [])].map((element) => ({ name: element.getAttribute('aria-label') || element.dataset.testid || element.className, rect: element.getBoundingClientRect() }))
  const found: string[] = []
  for (const [index, part] of parts.entries()) {
    if (!inside(part.rect, sheet)) found.push(`${part.name} stands outside the sheet`)
    if (overlap(part.rect, line)) found.push(`${part.name} lies over the Frame's line or beads`)
    for (const other of parts.slice(index + 1)) if (overlap(part.rect, other.rect)) found.push(`${part.name} overlaps ${other.name}`)
  }
  return found
}

const formOf = (root: HTMLElement) => root.querySelector('[data-testid="margin-sheet"]')!.className.match(/margin-sheet--(full|compact|folded|bare)/)?.[1]

describe('the margin sheet at each zoom (ticket 0658)', () => {
  for (const locale of FIT_LOCALES) {
    it(`is full at 100%, compact at 66% and folded at 40%, nothing clipped or overlapping, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const [at, form] of [[1, 'full'], [0.66, 'compact'], [0.4, 'folded']] as const) {
        zoom.value = at
        await settled(root)
        expect(formOf(root), `${at}`).toBe(form)
        expect(problems(root), `${at}`).toEqual([])
        expect(root.querySelector('[data-testid="frame-move-handle"]'), `${at}`).not.toBeNull()
      }
    })

    it(`fits at every zoom from 30% to 150%, and on a narrow Frame, stepping down a form where the sheet is too narrow, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      const found: Record<string, string[]> = {}
      for (const across of [40, 16, 8, 3]) {
        columns.value = across
        for (let percent = 30; percent <= 150; percent += 5) {
          zoom.value = percent / 100
          await settled(root)
          const wrong = problems(root)
          if (wrong.length) found[`${across} columns at ${percent}%`] = wrong
        }
      }
      expect(found).toEqual({})
    })
  }
})
