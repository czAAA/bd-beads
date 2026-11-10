import { describe, expect, it, onTestFinished } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { FrameAnchor } from '../../composables/tools/selectionBarPlacement'
import { createProject } from '../../domain/createProject'
import { createPalette, defaultPaletteIds } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { moveToRow, toggleRowDirection } from '../../domain/rowProgress'
import { frameOutsetPx } from '../../rendering/rulerScale'
import { FIT_MARGIN_PX } from '../../composables/canvas/useCanvasView'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import { FIT_LOCALES, mountAt } from '../../testUtils/browserFit'
import { paintAt } from '../../testUtils/layers'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import { useTitleBlockFold } from '../../composables/canvas/useTitleBlockFold'
import MarginSheet from './MarginSheet.vue'
import { withLayers } from '../../testUtils/layerFields'
import { browserDevicePreferences } from '../../services/devicePreferences'
import { MARGIN_PX } from '../../rendering/marginSizes'

// The margin sheet scales with its band, and under its smallest scale, 1, changes form (tickets 0658, 0698, 0851): at each zoom,
// and on a narrow Frame, nothing of the Frame stands outside its sheet, over its beads, or over another control.
// Measured in the page, in English and in the longest text of every language.

const zoom = ref(1)
const columns = ref(40)
const rows = ref(11)
/** Brick stitch gives the title block a Drop cell (ticket 0698). */
const technique = ref<'loom' | 'brick'>('loom')
const movePresses = ref(0)
/** The Frame's name: empty, its tab invites one (ticket 0803). */
const frameName = ref('Sun band')
/** The sheet's corner the title block is in: the Frame's own bottom-right on a turned Canvas (ticket 0728). */
const corner = ref({ top: false, left: false })
/** How many times Turn row direction has been pressed: once, the rows run left to right and Row done reads "Column
 * done"; twice, bottom to top (ticket 0851). */
const turns = ref(0)

/** Where a loom Frame of `columns` × `rows` and its sheet are at a zoom, as the surface reports them: beads of 20px at
 * 100%, its line out from them, its sheet 4 beads round them. */
function anchorAt(at: number, across: number): FrameAnchor {
  const band = 80 * at
  const outset = frameOutsetPx(at)
  const beads = { width: across * 20 * at, height: rows.value * 20 * at }
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
    frame: { row: 0, column: 0, rows: rows.value, columns: across, technique: technique.value, techniqueSettings: { brickDrop: 2 }, beads: {}, name: frameName.value },
})
  const painted = createPalette(defaultPaletteIds()).colors.map((color) => color.hex).slice(0, across).reduce((drawn, color, column) => paintAt(drawn, [{ row: 0, column }], color), bare)
  const turned = Array.from({ length: turns.value }).reduce<Project>((project) => toggleRowDirection(project), painted)
  return moveToRow(turned, 0)
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

describe('the margin sheet at each zoom (tickets 0658, 0698, 0851)', () => {
  for (const locale of FIT_LOCALES) {
    it(`is full at 100% and 90%, compact at 60% and folded at 45%, nothing clipped or overlapping, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const [at, form] of [[1, 'full'], [0.9, 'full'], [0.6, 'compact'], [0.45, 'folded']] as const) {
        zoom.value = at
        await settled(root)
        expect(formOf(root), `${at}`).toBe(form)
        expect(problems(root), `${at}`).toEqual([])
        expect(root.querySelector('[data-testid="frame-move-handle"]'), `${at}`).not.toBeNull()
      }
    })

    it(`fits an unnamed Frame's tab, "Name this frame" and its chevron, folded by hand at 100% and 60%, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      frameName.value = ''
      useTitleBlockFold().fold()
      onTestFinished(() => {
        frameName.value = 'Sun band'
        useTitleBlockFold().unfold()
      })
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const at of [1, 0.6]) {
        zoom.value = at
        await settled(root)
        expect(problems(root), `${at}`).toEqual([])
        expect(root.querySelector('[data-testid="margin-title-unfold"]'), `${at}`).not.toBeNull()
      }
    })

    it(`fits brick stitch's Drop cell in the title block at 150%, 100%, 90% and 60%, in ${locale}`, async () => {
      zoom.value = 1
      columns.value = 40
      technique.value = 'brick'
      onTestFinished(() => {
        technique.value = 'loom'
      })
      const { root } = await mountAt(Host, {}, { locale, width: 1280 })
      for (const at of [1.5, 1, 0.9, 0.6]) {
        zoom.value = at
        await settled(root)
        expect(problems(root), `${at}`).toEqual([])
        // At 60% the sheet is compact, its title block one row without the Drop cell.
        if (at < 0.85) continue
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

describe('the title block at the Frame\'s own corner on a turned Canvas (ticket 0728)', () => {
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

describe('the title block giving way at its new corner (tickets 498, 0728)', () => {
  it('gives way to a Selection\'s handles that reach under it at the top-left, and not to one at the bottom-right', async () => {
    const sheetAt = (selection?: { left: number; top: number; width: number; height: number }) =>
      defineComponent({
        setup: () => () => {
          const anchor = { ...anchorAt(1, 40), titleCorner: { top: true, left: true } }
          return h('div', { style: { position: 'relative', height: '400px' } }, [h(MarginSheet, { project: projectOf(40), anchor, editing: false, pressing: false, selection })])
        },
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

describe('the bare margin sheet, under a 31px band (tickets 0682, 0698, 0851)', () => {
  it('stands the Move bar over the middle of the Frame\'s top edge: it takes the press that drags, and a press on the first row reaches the bead', async () => {
    zoom.value = 1
    columns.value = 40
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    for (const across of [40, 3]) {
      columns.value = across
      for (const at of [0.1, 0.22, 0.35]) {
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

describe('the band\'s row after a label changes (ticket 0851)', () => {
  /** The row's form and what it shows, read from the page. */
  const rowOf = (root: HTMLElement) => {
    const band = root.querySelector<HTMLElement>('[data-testid="margin-band"]')
    return band ? `${band.dataset.form}: ${[...band.querySelectorAll('button')].map((button) => button.getAttribute('aria-label') || button.textContent?.trim()).join(', ')}` : 'none'
  }

  it('shows whole again once the shorter label is back, on every width of Frame', async () => {
    zoom.value = 1
    columns.value = 40
    turns.value = 0
    onTestFinished(() => {
      turns.value = 0
    })
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    const found: Record<number, string[]> = {}
    for (const across of [40, 24, 20, 18, 16, 14, 12, 10]) {
      columns.value = across
      turns.value = 0
      await settled(root)
      const before = rowOf(root)
      // Left to right, then bottom to top: Row done reads "Column done", then "Row done" again.
      turns.value = 1
      await settled(root)
      turns.value = 2
      await settled(root)
      const after = rowOf(root)
      if (after !== before) found[across] = [before, after]
    }
    expect(found).toEqual({})
  })

  it('shows whole again once English is back from the longer words of Spanish, on every width of Frame', async () => {
    zoom.value = 1
    columns.value = 40
    const language = browserDevicePreferences.get('locale')
    onTestFinished(() => {
      language.value = 'en'
    })
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    const found: Record<number, string[]> = {}
    for (const across of [40, 24, 20, 18, 16, 14, 12, 10]) {
      columns.value = across
      await settled(root)
      const before = rowOf(root)
      language.value = 'es'
      await settled(root)
      language.value = 'en'
      await settled(root)
      const after = rowOf(root)
      if (after !== before) found[across] = [before, after]
    }
    expect(found).toEqual({})
  })
})

/** What the sheet draws under `MARGIN_PX.legible` on screen (ticket 0851): words under 11px, and the band's buttons, the
 * bare Move bar and the name tab under 24px. The legend's letters mark its discs and the title block's switches,
 * pencils and fold button are the drafting sheet's own smaller marks: at scale 1 and up they are drawn as it draws them. */
function specks(root: HTMLElement): string[] {
  const { text, button } = MARGIN_PX.legible
  const sheet = root.querySelector<HTMLElement>('[data-testid="margin-sheet"]')!
  const found: string[] = []
  for (const element of sheet.querySelectorAll<HTMLElement>(':not(.margin-title__disc)')) {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || element.offsetHeight === 0) continue
    const words = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim())
    // A px of the element as the sheet's scale draws it.
    const size = parseFloat(getComputedStyle(element).fontSize) * (rect.height / element.offsetHeight)
    if (words && size < text - 0.05) found.push(`"${element.textContent!.trim()}" is ${size.toFixed(1)}px`)
  }
  const buttons = sheet.querySelectorAll<HTMLElement>(':is([data-testid="margin-band"], [data-testid="margin-handle"]) button:not([role="switch"]), [data-testid="margin-title-tab"]')
  for (const element of buttons) {
    const rect = element.getBoundingClientRect()
    if (Math.min(rect.width, rect.height) < button - 0.05) found.push(`${element.getAttribute('aria-label') || element.dataset.testid} is ${rect.width.toFixed(1)} × ${rect.height.toFixed(1)}px`)
  }
  return found
}

describe('the margin sheet readable at any zoom (ticket 0851)', () => {
  /** The zoom at which the view fits a loom Frame of `across` × `down` beads, as Fit does. */
  const fitZoom = (across: number, down: number, viewport: { width: number; height: number }) =>
    surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, viewport }).zoomToFit({ row: 0, column: 0, columns: across, rows: down }, FIT_MARGIN_PX)

  it('draws no word under 11px and no button under 24px at any zoom from 10% to 150%, on a wide and a narrow Frame', async () => {
    zoom.value = 1
    columns.value = 40
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    const found: Record<string, string[]> = {}
    for (const across of [40, 8]) {
      columns.value = across
      for (let percent = 10; percent <= 150; percent += 5) {
        zoom.value = percent / 100
        await settled(root)
        const small = specks(root)
        if (small.length) found[`${across} columns at ${percent}%`] = small
      }
    }
    expect(found).toEqual({})
  })

  it('on a phone at Fit draws a cuff\'s sheet bare, or in a form whose words and buttons are whole', async () => {
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 390 })
    const found: Record<number, string> = {}
    for (const across of [40, 20, 12]) {
      columns.value = across
      zoom.value = fitZoom(across, 11, { width: 390, height: 700 })
      await settled(root)
      found[across] = formOf(root)!
      expect(specks(root), `${across} columns`).toEqual([])
      expect(root.querySelector('[data-testid="frame-move-handle"]'), `${across} columns`).not.toBeNull()
    }
    // A 40-column cuff's beads are 6px, its band 26px: bare, where at the old 0.6 its tools were 14px and its words 7px.
    expect(found[40]).toBe('bare')
  })

  it('on Full HD at Fit shows a big tapestry\'s and a converted piece\'s sheet bare, the Move bar alone', async () => {
    onTestFinished(() => {
      rows.value = 11
    })
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280 })
    for (const [across, down] of [[300, 120], [240, 160]]) {
      columns.value = across
      rows.value = down
      zoom.value = fitZoom(across, down, { width: 1600, height: 900 })
      await settled(root)
      expect(formOf(root), `${across} × ${down}`).toBe('bare')
      expect(specks(root), `${across} × ${down}`).toEqual([])
      expect(root.querySelector('[data-testid="frame-move-handle"]'), `${across} × ${down}`).not.toBeNull()
    }
  })
})
