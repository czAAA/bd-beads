import { test, type Page } from '@playwright/test'
import { changeFrame } from '../../src/domain/changeFrame'
import { framedGrid } from '../../src/domain/layerBeads'
import { frameLayoutOf } from '../../src/domain/frameShape'
import { frameOf, withFrameSheet } from '../../src/domain/layerRecord'
import { onLayer } from '../../src/domain/layers'
import { paintCells } from '../../src/domain/drawing'
import { findBuiltInColor } from '../../src/domain/palette'
import type { BeadMap } from '../../src/domain/canvas'
import type { Cell, Project } from '../../src/domain/project'
import { withLayers } from '../../src/testUtils/layerFields'
import { openApp, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// The Lifted piece's cost in Safari's engine at an iPad's density (ticket 1034), by hand with
// `E2E_PORT=<a free port> npm run perf -- liftedPiece`: the longest gap between two frames over a full redraw (the window
// resized), a Progress bar step and zoom steps, on four synthetic Projects. Env: PERF_LIFT (fixture names, comma separated).

const [COLUMNS, ROWS] = [130, 231]
const BUDGET_MS = 250
/** How long after an action its gaps are still watched: a redraw put off to the next frame or a settle is counted. */
const AFTERMATH_MS = 1500
const ONLY = process.env.PERF_LIFT?.split(',')

test.use({ browserName: 'webkit', deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 } })

const [GREY, RED] = ['grey', 'red'].map((id) => findBuiltInColor(id)!.hex) as [string, string]

/** A COLUMNS × ROWS loom Frame of TOHO Cube beads, painted where `painted` says. */
function framed(id: string, painted: (row: number, column: number) => boolean): Project {
  const grid: Cell[][] = Array.from({ length: ROWS }, (_row, row) => Array.from({ length: COLUMNS }, (_cell, column) => ({ color: painted(row, column) ? (row % 10 === 0 ? RED : GREY) : null })))
  const base = fixtureProject({ technique: 'loom', blank: true })
  const [canvas, frame] = framedGrid(grid, { technique: 'loom', beadId: 'toho-cube-1.5mm' }).layers
  return { ...base, id, layers: [{ ...base.layers[0]!, ...canvas, id: 'perf-canvas', name: `Perf ${id}` }, { ...base.layers[1]!, ...frame!, id: 'perf-frame' }] }
}

/** A full Canvas Piece of the same size beside a small Frame, which keeps the Progress bar. */
function canvasPiece(): Project {
  const small = framed('canvas-piece', () => true)
  const frame = { ...frameOf(small)!, columns: 4, rows: 4 }
  const beads: BeadMap = {}
  for (let row = 0; row < ROWS; row += 1) {
    beads[row] = {}
    for (let column = 0; column < COLUMNS; column += 1) beads[row]![column + 20] = row % 10 === 0 ? RED : GREY
  }
  return withLayers(withFrameSheet(small, { ...frame, beads: { 0: { 0: RED } } }), { beads })
}

/** A Triangle Custom frame of 40 rounds, every bead painted: each bead stands at its panel's angle. */
function turnedFrame(): Project {
  const open = withFrameSheet(fixtureProject({ technique: 'loom', blank: true }), undefined)
  const placed = changeFrame(open, { custom: { shape: 'triangle', size: 40, centre: { row: 60, column: 60 } } })
  if (placed.kind !== 'changed') throw new Error('expected a Custom frame')
  const positions = frameLayoutOf(frameOf(placed.project)!)!.positions
  return { ...onLayer(placed.project, 'frame', (view) => paintCells(view, [...positions], GREY)), id: 'turned' }
}

const FIXTURES: Record<string, () => Project> = {
  'full frame': () => framed('full-frame', () => true),
  'canvas piece': canvasPiece,
  checkered: () => framed('checkered', (row, column) => (row + column) % 2 === 0),
  'turned frame': turnedFrame,
}

/** The longest gap between two frames while `act` runs and for AFTERMATH_MS after it, in ms. A stop that outlasts the
 * watch is waited out and counted: while the screen stands still no frame comes to end a gap. */
async function longestGap(page: Page, act: () => Promise<void>): Promise<number> {
  await settle(page)
  await page.evaluate(() => {
    const watch = { last: performance.now(), most: 0, running: true }
    ;(window as unknown as { __gaps: typeof watch }).__gaps = watch
    const tick = (now: number) => {
      watch.most = Math.max(watch.most, now - watch.last)
      watch.last = now
      if (watch.running) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await act()
  await page.waitForTimeout(AFTERMATH_MS)
  await settle(page)
  return page.evaluate(() => {
    const watch = (window as unknown as { __gaps: { most: number; running: boolean } }).__gaps
    watch.running = false
    return watch.most
  })
}

const lines: string[] = []

for (const [name, build] of Object.entries(FIXTURES)) {
  if (ONLY && !ONLY.includes(name)) continue
  test(`the Lifted piece of a ${name} in WebKit at 2×`, async ({ page }) => {
    // A step that freezes the page is reported by the lines missing after it, not waited on for the whole run.
    test.setTimeout(5 * 60_000)
    await openApp(page, [build()])
    await page.mouse.move(2, 2)
    await page.waitForTimeout(AFTERMATH_MS)
    const step = async (what: string, act: () => Promise<void>) => {
      const zoom = await page.getByTestId('canvas-strip-zoom').getAttribute('data-zoom-percent')
      const ms = await longestGap(page, act)
      lines.push(`${name.padEnd(14)} ${`at ${zoom}%`.padEnd(8)} ${what.padEnd(18)} ${ms.toFixed(0).padStart(6)} ms  ${ms > BUDGET_MS ? `OVER ${BUDGET_MS}` : 'ok'}`)
    }
    /** A press of a zoom button, where the zoom has a step left that way: at its end the button waits for nobody. */
    const zoomStep = async (button: 'zoom-in' | 'zoom-out') => {
      if (await page.getByTestId(button).isEnabled()) await step(`${button === 'zoom-in' ? 'zoom step in' : 'zoom step out'}`, () => page.getByTestId(button).click())
    }
    // Each line is kept as it is measured, so a step that never ends still leaves those before it.
    await step('full redraw', () => page.setViewportSize({ width: 1366, height: 1000 }))
    await step('Progress bar step', () => page.getByTestId('progress-bar-next').click())
    await zoomStep('zoom-in')
    await zoomStep('zoom-out')
    await zoomStep('zoom-out')
  })
}

test.afterAll(() => {
  console.log(['', `The Lifted piece in WebKit at 2× (ticket 1034): the longest gap between two frames, under ${BUDGET_MS} ms`, ...lines, ''].join('\n'))
})
