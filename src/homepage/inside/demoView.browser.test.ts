import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import InsideEditor from './InsideEditor.vue'
import { DEMO_CUFF, DEMO_VIEW_MARGIN } from './demoProjects'

// The view the tour plays in (Homepage card, Its view; ticket 1061): the cuff's Frame and 4 beads either side across
// nine tenths of the drawing area at every size of the demo, or as much as its height allows, however often it is set.

/** The demo editor in a box of a size, and its handle. */
async function demoEditor(width: number, height: number) {
  const editor = ref<InstanceType<typeof InsideEditor>>()
  const Box = defineComponent(() => () => h('div', { style: { display: 'grid', width: `${width}px`, height: `${height}px` } }, [h(InsideEditor, { ref: editor })]))
  const mounted = await mountAt(Box, {}, { locale: 'en', width: 2560, text: false })
  await page.viewport(2560, 1440)
  await editor.value!.fresh()
  return { editor: editor.value!, root: mounted.root }
}

/** What the view shows: the share of the drawing area's width the cuff's Frame and its margin span, and the zoom. */
function viewOf(editor: InstanceType<typeof InsideEditor>, root: Element) {
  const canvas = editor.hand(true, new AbortController().signal).canvas
  const area = root.querySelector('[data-testid="app-drawing-area"]')!.getBoundingClientRect()
  const at = (row: number) => canvas.surfaceProbe.value!.beadOnScreen({ row, column: DEMO_CUFF.column })!
  const along = Math.abs(at(DEMO_CUFF.row + DEMO_CUFF.rows - 1).x - at(DEMO_CUFF.row).x) / (DEMO_CUFF.rows - 1)
  return { span: (along * (DEMO_CUFF.rows + 2 * DEMO_VIEW_MARGIN)) / area.width, zoom: canvas.zoom.value, canvas }
}

/** The lines the cuff's Margin sheet adds to its Frame's (InsideEditor's own, ticket 0802). */
const SHEET_MARGIN_LINES = 8

describe("What's inside's view fills its demo (ticket 1061)", () => {
  // A tablet's demo and a large screen's, where the view was held to three times the zoom a fresh demo started at.
  for (const [width, height] of [[760, 620], [1260, 1150]] as const) {
    it(`spans nine tenths of a ${width} × ${height} demo, and stays there however often it is set`, async () => {
      const { editor, root } = await demoEditor(width, height)
      const fitted = viewOf(editor, root)
      expect(fitted.span).toBeCloseTo(0.9, 2)
      for (let again = 0; again < 5; again++) await editor.refit()
      expect(viewOf(editor, root).zoom, 'set again, never past the fit').toBeCloseTo(fitted.zoom, 4)
      // From a view far smaller than the fit (an editor that started zoomed out), setting it again reaches the fit.
      fitted.canvas.setZoom(0.1)
      await editor.refit()
      expect(viewOf(editor, root).zoom).toBeCloseTo(fitted.zoom, 4)
    }, 60000)
  }

  it('is as large as the height allows in a short demo: its sheet as tall as the room the Tool pill leaves', async () => {
    const { editor, root } = await demoEditor(1100, 360)
    const { span, canvas } = viewOf(editor, root)
    expect(span, 'the height is the limit').toBeLessThan(0.85)
    const area = root.querySelector('[data-testid="app-drawing-area"]')!.getBoundingClientRect()
    const pill = root.querySelector('[data-testid="tool-pill"]')!.getBoundingClientRect().height
    const at = (column: number) => canvas.surfaceProbe.value!.beadOnScreen({ row: DEMO_CUFF.row, column })!
    const line = Math.abs(at(DEMO_CUFF.column + DEMO_CUFF.columns - 1).y - at(DEMO_CUFF.column).y) / (DEMO_CUFF.columns - 1)
    // The sheet: the Frame's lines and 8 of margin, round the view's middle, clear of the pill with as much room above.
    expect((DEMO_CUFF.columns + SHEET_MARGIN_LINES) * line).toBeCloseTo(area.height - 2 * (pill + 16), 0)
  }, 60000)
})
