import { test, type CDPSession, type Page } from '@playwright/test'
import type { GridPosition } from '../../src/domain/grid'
import { createProject } from '../../src/domain/createProject'
import { encodeProject } from '../../src/domain/projectEncoding'
import { findBuiltInColor } from '../../src/domain/palette'
import { withLayers } from '../../src/testUtils/layerFields'
import { projectBox, selectTool, setZoom, settle } from '../support/app'
import { beadCentre } from '../support/projects'
import { attribution, busyMs, longFramesSince, metricMs, pageNow, throttle, watchLongFrames } from './measure'

// A Project that won't open (ticket 0716), `npm run perf -- hugeProject`: a synthetic stored Project of one solid layer of
// millions of beads; the Saved Projects subpanel, the open to its first frame, then a stroke, a Fill and Undo on it.
// Env: PERF_SLOWDOWNS (4), PERF_HUGE_MILLIONS (9; a list such as 1,2,9,12 finds where an open passes a second).

const SLOWDOWNS = (process.env.PERF_SLOWDOWNS ?? '4').split(',').map(Number)
const MILLIONS = (process.env.PERF_HUGE_MILLIONS ?? '9').split(',').map(Number)
const OPEN_BUDGET_MS = 1000
const EDIT_BUDGET_MS = 100
const AFTERMATH_MS = 300
const STORAGE_KEY = 'openbeads:patterns'
const OPENING_KEY = 'openbeads:opening'

const lines: string[] = []

/** The enclosed patch a Fill floods: a 16 × 16 white square in a red ring, in the middle of the layer. */
const PATCH = 16

/** The stored library: one Project whose Canvas is `side` × `side` grey beads with the patch in its middle, written in
 * the stored form straight away (version 6), so nothing here holds millions of beads. */
function hugeLibrary(side: number): { stored: string; middle: number } {
  const [grey, red, white] = ['grey', 'red', 'white'].map((id) => findBuiltInColor(id)!.hex)
  const base = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 15, height: 15, unit: 'mm' } }), {
    id: 'huge',
    name: 'Huge',
    frame: undefined,
    pieceNames: [{ row: 0, column: 0, name: 'Ground' }],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    savedAt: 1_700_000_000_000,
  })
  const encoded = encodeProject(base)
  const middle = Math.floor(side / 2)
  const [top, left] = [middle - PATCH / 2 - 1, middle - PATCH / 2 - 1]
  const rows: Record<string, string> = {}
  for (let row = 0; row < side; row += 1) {
    const inRing = row >= top && row < top + PATCH + 2
    const edge = row === top || row === top + PATCH + 1
    rows[String(row)] = !inRing
      ? `0:1x${side}`
      : edge
        ? `0:1x${left},2x${PATCH + 2},1x${side - left - PATCH - 2}`
        : `0:1x${left},2,3x${PATCH},2,1x${side - left - PATCH - 2}`
  }
  const layer = { ...encoded.layers[0]!, encodedBeads: { colors: [grey, red, white], rows } }
  return { stored: JSON.stringify({ version: 6, patterns: [{ ...encoded, layers: [layer] }] }), middle }
}

/** Opens the app on the library with the Project held back by a safe start's note (set by hand), so a Project under the
 * gate is opened from Saved Projects too and every size is measured the same way: from the pick to its first frame. */
async function openWith(page: Page, stored: string): Promise<void> {
  await page.addInitScript(
    ({ key, value, opening }) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value)
        localStorage.setItem(opening, JSON.stringify({ id: 'huge', name: 'Huge' }))
      }
      localStorage.setItem('openbeads:storage-note-seen', 'yes')
    },
    { key: STORAGE_KEY, value: stored, opening: OPENING_KEY },
  )
  await page.goto('./')
  await page.getByTestId('app-canvas').waitFor()
}

/** Main-thread busy time of `act` and what it set going, in ms. */
async function oneOff(page: Page, cdp: CDPSession, act: () => Promise<void>): Promise<{ ms: number; note: string }> {
  await settle(page)
  const since = await pageNow(page)
  const before = await busyMs(cdp)
  await act()
  await settle(page)
  await page.waitForTimeout(AFTERMATH_MS)
  const ms = (await busyMs(cdp)) - before
  const frames = await longFramesSince(page, since)
  return { ms, note: frames?.length ? `${frames.length} long frames; ${attribution(frames)}` : '' }
}

function report(slowdown: number, millions: number, what: string, ms: number, budget: number, note = ''): void {
  lines.push(`${String(slowdown)}× ${String(millions).padStart(4)} M  ${what.padEnd(26)} ${ms.toFixed(0).padStart(6)} ms  ${ms > budget ? `OVER ${budget}` : 'ok'}  ${note}`)
}

for (const slowdown of SLOWDOWNS) {
  for (const millions of MILLIONS) {
    test(`a ${millions}-million-bead Project at ${slowdown}× slowdown`, async ({ page }) => {
      const side = Math.round(Math.sqrt(millions * 1_000_000))
      const { stored, middle } = hugeLibrary(side)
      await watchLongFrames(page)
      await openWith(page, stored)
      const cdp = await throttle(page, slowdown)

      // The load opened none and put Menu on Saved Projects; close it and open the subpanel again, measured.
      await page.keyboard.press('Escape')
      await settle(page)
      await page.getByTestId('strip-menu').click()
      const list = await oneOff(page, cdp, () => page.getByTestId('menu-saved-projects').click())
      report(slowdown, millions, 'Saved Projects subpanel', list.ms, EDIT_BUDGET_MS, list.note)

      // From the pick (Open anyway, over the gate) to the first drawn frame: the safe start's note is cleared one frame
      // after it.
      let started = await page.evaluate(() => performance.now())
      await page.getByTestId('select-project-huge').click()
      const opened = (key: string) => localStorage.getItem(key) === null && !!document.querySelector('[data-testid="project-surface"]')
      const first = await page.waitForFunction(
        (key) => (localStorage.getItem(key) === null && document.querySelector('[data-testid="project-surface"]') ? 'opened' : document.querySelector('[data-testid="open-large-project-modal"]') ? 'gated' : false),
        OPENING_KEY,
        { timeout: 120_000 },
      )
      const gated = (await first.jsonValue()) === 'gated'
      if (gated) {
        started = await page.evaluate(() => performance.now())
        await page.locator('[data-testid="open-large-project-modal"] [data-testid="confirm-modal-confirm"]').click()
        await page.waitForFunction(opened, OPENING_KEY, { timeout: 120_000 })
      }
      const toFrame = (await page.evaluate(() => performance.now())) - started
      report(slowdown, millions, gated ? 'Open anyway to first frame' : 'open to first frame', toFrame, OPEN_BUDGET_MS)

      // The edits of the 0673 `edits` scenario on it: a stroke, a Fill of the enclosed patch, Undo.
      await setZoom(page, 100)
      const surface = page.getByTestId('project-surface')
      const zoom = Number(await surface.getAttribute('data-zoom'))
      const box = await projectBox(page, (await surface.boundingBox())!)
      const at = (position: GridPosition) => beadCentre({ technique: 'loom', rotation: 0 }, box, zoom, position)

      await selectTool(page, 'paint')
      const from = at({ row: middle - 20, column: middle - 10 })
      await page.mouse.move(from.x, from.y)
      const scriptBefore = await metricMs(cdp, 'ScriptDuration')
      await page.mouse.down()
      for (let step = 1; step <= 20; step += 1) {
        const next = at({ row: middle - 20, column: middle - 10 + step })
        await page.mouse.move(next.x, next.y)
      }
      const perMove = ((await metricMs(cdp, 'ScriptDuration')) - scriptBefore) / 20
      report(slowdown, millions, 'stroke, script a move', perMove, 8)
      const strokeEnd = await oneOff(page, cdp, () => page.mouse.up())
      report(slowdown, millions, 'stroke end', strokeEnd.ms, EDIT_BUDGET_MS, strokeEnd.note)

      await selectTool(page, 'fill')
      const inside = at({ row: middle, column: middle })
      const fill = await oneOff(page, cdp, () => page.mouse.click(inside.x, inside.y))
      report(slowdown, millions, 'fill (256 beads)', fill.ms, EDIT_BUDGET_MS, fill.note)

      const undo = await oneOff(page, cdp, () => page.keyboard.press('ControlOrMeta+z'))
      report(slowdown, millions, 'undo', undo.ms, EDIT_BUDGET_MS, undo.note)
    })
  }
}

test.afterAll(() => {
  console.log(['', `A Project that won't open (ticket 0716): open under ${OPEN_BUDGET_MS} ms, a click under ${EDIT_BUDGET_MS} ms`, ...lines, ''].join('\n'))
})
