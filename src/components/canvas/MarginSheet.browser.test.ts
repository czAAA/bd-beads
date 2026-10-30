import { describe, expect, it, onTestFinished } from 'vitest'
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
import { withLayers } from '../../testUtils/layerFields'

// The margin sheet scales with its band, and under its smallest scale changes form (tickets 0658, 0698): at each zoom,
// and on a narrow Frame, nothing of the Frame stands outside its sheet, over its beads, or over another control.
// Measured in the page, in English and in the longest text of every language.

const zoom = ref(1)
const columns = ref(40)
/** Brick stitch gives the title block a Drop cell (ticket 0698). */
const technique = ref<'loom' | 'brick'>('loom')
const movePresses = ref(0)
/** The sheet's corner the title block is in: the Frame's own bottom-right on a turned Canvas (ticket 0726). */
const corner = ref({ top: false, left: false })

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
    titleCorner: corner.value,
  }
}

function projectOf(across: number): Project {
  const bare: Project = withLayers(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 12, height: 12, unit: 'beads' } }), {
makerName: 'Ada',
    frame: { row: 0, column: 0, rows: 11, columns: across, technique: technique.value, techniqueSettings: { brickDrop: 2 }, beads: {}, name: 'Sun band' },
})
  const painted = createPalette(defaultPaletteIds()).colors.map((color) => color.hex).slice(0, across).reduce((drawn, color, column) => paintAt(drawn, [{ row: 0, column }], color), bare)
  return moveToRow(painted, 0)
}

const Host = defineComponent({
  setup() {
    // Bare, the Move bar stands above the sheet's top edge (ticket 0682): the host leaves it room.
    return () =>
      h('div', { style: { position: 'relative', margin: '48px 16px 16px', height: `${anchorAt(zoom.value, columns.value).sheet.height}px` }, 'data-testid': 'under-sheet' }, [
        h(MarginSheet, { project: projectOf(columns.value), anchor: anchorAt(zoom.value, columns.value), editing: false, pressing: false, onMovePress: () => movePresses.value++ }),
      ])
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
  // Bare, the Move bar alone may stand outside where the sheet would be, but never over the Frame's line or beads.
  const handle = root.querySelector<HTMLElement>('[data-testid="margin-handle"] button')
  if (handle && overlap(handle.getBoundingClientRect(), line)) found.push('the bare Move bar lies over the Frame\'s line or beads')
  for (const [index, part] of parts.entries()) {
    if (!inside(part.rect, sheet)) found.push(`${part.name} stands outside the sheet`)
    if (overlap(part.rect, line)) found.push(`${part.name} lies over the Frame's line or beads`)
    for (const other of parts.slice(index + 1)) if (overlap(part.rect, other.rect)) found.push(`${part.name} overlaps ${other.name}`)
  }
  return found
}

const formOf = (root: HTMLElement) => root.querySelector('[data-testid="margin-sheet"]')!.className.match(/margin-sheet--(full|compact|folded|bare)/)?.[1]

describe('the margin sheet at each zoom (tickets 0658, 0698)', () => {
  for (const locale of FIT_LOCALES) {
    it(`is full at 100% and 60%, compact at 40% and folded at 25%, nothing clipped or overlapping, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const [at, form] of [[1, 'full'], [0.6, 'full'], [0.4, 'compact'], [0.25, 'folded']] as const) {
        zoom.value = at
        await settled(root)
        expect(formOf(root), `${at}`).toBe(form)
        expect(problems(root), `${at}`).toEqual([])
        expect(root.querySelector('[data-testid="frame-move-handle"]'), `${at}`).not.toBeNull()
      }
    })

    it(`fits brick stitch's Drop cell in the title block at 150%, 100%, 60% and 40%, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      technique.value = 'brick'
      onTestFinished(() => {
        technique.value = 'loom'
      })
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const at of [1.5, 1, 0.6, 0.4]) {
        zoom.value = at
        await settled(root)
        expect(problems(root), `${at}`).toEqual([])
        // At 40% the longest text's title block is the tab: the sheet is too narrow for even its brief row.
        if (at < 0.6) continue
        expect(root.querySelector('[data-testid="margin-brick-drop-short"]'), `${at}`).not.toBeNull()
        // The full block's pencils stand on one line, the Technique's picker too.
        const pencils = ['margin-frame-name-edit', 'margin-technique-picker', 'margin-brick-drop-edit', 'margin-maker-edit']
          .map((id) => root.querySelector(`[data-testid="${id}"] svg`)!.getBoundingClientRect())
          .map((icon) => icon.top + icon.height / 2)
        expect(Math.max(...pencils) - Math.min(...pencils), `${at}`).toBeLessThan(0.5)
      }
    })

    it(`fits at every zoom from 25% to 150%, and on a narrow Frame, stepping down a form where the sheet is too narrow, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      const found: Record<string, string[]> = {}
      for (const across of [40, 16, 8, 3]) {
        columns.value = across
        for (let percent = 25; percent <= 150; percent += 5) {
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

describe('the title block at the Frame\'s own corner on a turned Canvas (ticket 0726)', () => {
  const corners = { 0: { top: false, left: false }, 90: { top: false, left: true }, 180: { top: true, left: true }, 270: { top: true, left: false } }

  for (const locale of FIT_LOCALES) {
    it(`sits in its corner at every turn, the band's row beside it at the top, nothing overlapping, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      onTestFinished(() => {
        corner.value = corners[0]
      })
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      const found: Record<string, string[]> = {}
      for (const [turn, at] of Object.entries(corners)) {
        corner.value = at
        for (const across of [40, 16, 8]) {
          columns.value = across
          for (const percent of [150, 100, 60, 40, 25]) {
            zoom.value = percent / 100
            await settled(root)
            const where = `${turn}° with ${across} columns at ${percent}%`
            const wrong = problems(root)
            const sheet = root.querySelector('[data-testid="margin-sheet"]')!.getBoundingClientRect()
            const title = root.querySelector('[data-testid="margin-title"] > *')?.getBoundingClientRect()
            if (title) {
              const middle = { x: sheet.left + sheet.width / 2, y: sheet.top + sheet.height / 2 }
              const top = title.bottom < middle.y
              const left = title.right < middle.x || (title.left - sheet.left < sheet.right - title.right && title.left < middle.x)
              if (top !== at.top || left !== at.left) wrong.push(`the title block is not in its corner`)
            }
            if (!root.querySelector('[data-testid="frame-move-handle"]')) wrong.push('no Move bar')
            if (wrong.length) found[where] = wrong
          }
        }
      }
      expect(found).toEqual({})
    })
  }
})

describe('the title block giving way at its new corner (tickets 498, 0726)', () => {
  it('gives way to a Selection\'s handles that reach under it at the top-left, and not to one at the bottom-right', async () => {
    const sheetAt = (selection?: { left: number; top: number; width: number; height: number }) =>
      defineComponent({
        setup: () => () => h('div', { style: { position: 'relative', height: '400px' } }, [h(MarginSheet, { project: projectOf(40), anchor: { ...anchorAt(1, 40), titleCorner: { top: true, left: true } }, editing: false, pressing: false, selection })]),
      })
    const yielding = async (selection: { left: number; top: number; width: number; height: number }) => {
      const { root } = await mountAt(sheetAt(selection), {}, { locale: 'en', width: 1280 })
      await settled(root)
      return root.querySelector('[data-testid="margin-title"]')!.classList.contains('margin-sheet__yielding')
    }
    expect(await yielding({ left: 40, top: 40, width: 200, height: 100 })).toBe(true)
    expect(await yielding({ left: 700, top: 250, width: 100, height: 60 })).toBe(false)
  })
})

describe('the bare margin sheet, under 0.6 of a 31px band (tickets 0682, 0698)', () => {
  it('stands the Move bar over the middle of the Frame\'s top edge: it takes the press that drags, and a press on the first row reaches the bead', async () => {
    zoom.value = 1
    columns.value = 40
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    for (const across of [40, 3]) {
      columns.value = across
      for (const at of [0.1, 0.15, 0.22]) {
        zoom.value = at
        movePresses.value = 0
        await settled(root)
        const name = `${across} columns at ${at * 100}%`
        expect(formOf(root), name).toBe('bare')
        const sheet = root.querySelector<HTMLElement>('[data-testid="margin-sheet"]')!

        const { box } = anchorAt(at, across)
        const origin = sheet.getBoundingClientRect()
        const line = new DOMRect(origin.left + box.left, origin.top + box.top, box.width, box.height)
        const bar = root.querySelector<HTMLElement>('[data-testid="frame-move-handle"]')!.getBoundingClientRect()
        expect([bar.width, bar.height], name).toEqual([56, 24])
        expect(bar.left + bar.width / 2, name).toBeCloseTo(line.left + line.width / 2, 1)
        expect(bar.bottom, name).toBeCloseTo(line.top, 1)

        // What a press lands on: the Move bar at its middle, the canvas under the sheet at the first row's first bead.
        const pressAt = (x: number, y: number) => {
          const target = document.elementFromPoint(x, y)!
          target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }))
          return target
        }
        expect(pressAt(bar.left + bar.width / 2, bar.top + bar.height / 2).closest('[data-testid="frame-move-handle"]'), name).not.toBeNull()
        expect(movePresses.value, name).toBe(1)
        const bead = 20 * at
        const outset = frameOutsetPx(at)
        expect(pressAt(line.left + outset + bead / 2, line.top + outset + bead / 2).getAttribute('data-testid'), name).toBe('under-sheet')
        expect(movePresses.value, name).toBe(1)
      }
    }
  })
})
