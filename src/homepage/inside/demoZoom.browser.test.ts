import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { page } from 'vitest/browser'
import { frameOf } from '../../domain/layerRecord'
import { mountAt } from '../../testUtils/browserFit'
import type { InsideRowId } from '../../i18n/translations'
import InsideEditor from './InsideEditor.vue'
import { DEMO_CUFF } from './demoProjects'
import { TOUR_SCRIPTS } from './tourScripts'

// The demo drawn larger by CSS zoom (ticket 1071), as the Homepage draws it past 1440 × 900 or at a zoom of its own: the
// Canvas reads the screen in on-screen px and places its sheet and bars in its own, so they stay where they are at 1.

/** How much larger the demo is drawn: the Homepage's third more at 2560 × 1440, and one at a zoom of 150%. */
const ZOOMS = [4 / 3, 1.5] as const

/** The demo editor at the desk's size, drawn `zoom` times larger, and its handle. */
async function demoEditor(zoom: number) {
  const editor = ref<InstanceType<typeof InsideEditor>>()
  const Box = defineComponent(() => () => h('div', { style: { zoom: String(zoom) } }, [h('div', { style: { display: 'grid', width: '1100px', height: '700px' } }, [h(InsideEditor, { ref: editor })])]))
  const mounted = await mountAt(Box, {}, { locale: 'en', width: 2560, text: false })
  await page.viewport(2560, 1440)
  await editor.value!.fresh()
  return { editor: editor.value!, root: mounted.root }
}

/** Applies the tour's rows up to and with `last`, at once. */
async function applyThrough(editor: InstanceType<typeof InsideEditor>, last: InsideRowId) {
  const hand = editor.hand(true, new AbortController().signal)
  for (const [row, script] of Object.entries(TOUR_SCRIPTS)) {
    await script(hand)
    if (row === last) break
  }
  const { row, column, rows, columns } = frameOf(hand.canvas.activeProject.value!)!
  return { row, column, rows, columns }
}

const boxOf = (root: Element, id: string) => root.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
/** Whether `inner` lies inside `outer`, to a px. */
const inside = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1

describe("What's inside drawn larger by the Homepage's zoom (ticket 1071)", () => {
  for (const zoom of ZOOMS) {
    it(`sets its view round the cuff, in the middle of the drawing area, at ${zoom.toFixed(2)}`, async () => {
      const { editor, root } = await demoEditor(zoom)
      const canvas = editor.hand(true, new AbortController().signal).canvas
      const area = boxOf(root, 'app-drawing-area')
      const at = (row: number, column: number) => canvas.surfaceProbe.value!.beadOnScreen({ row, column })!
      const first = at(DEMO_CUFF.row, DEMO_CUFF.column)
      const last = at(DEMO_CUFF.row + DEMO_CUFF.rows - 1, DEMO_CUFF.column + DEMO_CUFF.columns - 1)
      // Its sheet's lines, and its middle at the area's but for a bead and a half along (the Starter's, InsideEditor).
      expect(Math.abs((first.y + last.y) / 2 - (area.top + area.height / 2))).toBeLessThan(2)
      expect(Math.abs(last.x - first.x) / area.width).toBeGreaterThan(0.6)
      expect(inside(new DOMRect(Math.min(first.x, last.x), Math.min(first.y, last.y), Math.abs(last.x - first.x), Math.abs(last.y - first.y)), area)).toBe(true)
    }, 60000)

    it(`lays the Starter's ring where the band was, at ${zoom.toFixed(2)}`, async () => {
      const { editor } = await demoEditor(zoom)
      // As at zoom 1 (tourRows): the Starter is laid round the bead under the view's middle.
      expect(await applyThrough(editor, 'starters')).toEqual({ row: 10, column: 12, rows: 36, columns: 7 })
    }, 60000)

    it(`keeps the cuff's sheet whole and clear of the Tool pill, and the Reference image bar in the demo, at ${zoom.toFixed(2)}`, async () => {
      const { editor, root } = await demoEditor(zoom)
      expect(await applyThrough(editor, 'reference'), 'the cuff round the same middle').toEqual({ row: 4, column: 4, rows: 48, columns: 23 })
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const area = boxOf(root, 'app-drawing-area')
      const sheet = boxOf(root, 'margin-sheet')
      const pill = boxOf(root, 'tool-pill')
      expect(inside(sheet, area), 'the sheet whole in the drawing area').toBe(true)
      expect(sheet.bottom, 'the sheet above the Tool pill').toBeLessThanOrEqual(pill.top + 1)
      expect(boxOf(root, 'margin-title').bottom, "the title block above the Tool pill").toBeLessThanOrEqual(pill.top + 1)
      expect(inside(boxOf(root, 'picture-bar'), boxOf(root, 'inside-editor')), 'the Reference image bar in the demo').toBe(true)
    }, 120000)
  }
})
