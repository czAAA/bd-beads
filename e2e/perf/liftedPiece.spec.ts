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
import { drawsDraft } from '../../src/rendering/draftRenderer'
import { openApp, selectTool, settle } from '../support/app'
import { fixtureProject } from '../support/projects'

// The Lifted piece's cost in Safari's engine at an iPad's density (tickets 1034, 1039), `E2E_PORT=<a free port> npm run
// perf -- liftedPiece`: the longest gap between two frames over a full redraw (the window resized), a Progress bar step,
// zoom steps and, on STROKED, a stroke and a pan, on synthetic Projects. Env: PERF_LIFT (fixture names, comma separated).

const [COLUMNS, ROWS] = [130, 231]
const BUDGET_MS = 250
/** How long after an action its gaps are still watched: a redraw put off to the next frame or a settle is counted. */
const AFTERMATH_MS = 1500
const ONLY = process.env.PERF_LIFT?.split(',')

/** An iPad's pixel density, where the full look is drawn. */
const DENSITY = 2

test.use({ browserName: 'webkit', deviceScaleFactor: DENSITY, viewport: { width: 1366, height: 1024 } })

const [GREY, RED] = ['grey', 'red'].map((id) => findBuiltInColor(id)!.hex) as [string, string]

/** A loom Frame, COLUMNS × ROWS of TOHO Cube beads unless `size` says otherwise, painted where `painted` says. */
function framed(id: string, painted: (row: number, column: number) => boolean, size: { columns?: number; rows?: number; beadId?: string } = {}): Project {
  const { columns = COLUMNS, rows = ROWS, beadId = 'toho-cube-1.5mm' } = size
  const grid: Cell[][] = Array.from({ length: rows }, (_row, row) => Array.from({ length: columns }, (_cell, column) => ({ color: painted(row, column) ? (row % 10 === 0 ? RED : GREY) : null })))
  const base = fixtureProject({ technique: 'loom', blank: true })
  const [canvas, frame] = framedGrid(grid, { technique: 'loom', beadId }).layers
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

const ROUND = { beadId: 'toho/round/11-0' }
/** A larger Frame (ticket 1039), drawn in the full look at its fit zoom at 2×. */
const LARGE = { columns: 380, rows: 290 }

const FIXTURES: Record<string, () => Project> = {
  'full frame': () => framed('full-frame', () => true),
  'canvas piece': canvasPiece,
  checkered: () => framed('checkered', (row, column) => (row + column) % 2 === 0),
  'turned frame': turnedFrame,
  'round full': () => framed('round-full', () => true, ROUND),
  // Diagonal bands four beads wide: each row steps one bead along, so every step of each band's edge is an inner corner.
  'round stairs': () => framed('round-stairs', (row, column) => Math.floor((row + column) / 4) % 2 === 0, ROUND),
  'large full': () => framed('large-full', () => true, LARGE),
  'large checkered': () => framed('large-checkered', (row, column) => (row + column) % 2 === 0, LARGE),
}

/** The Frames a stroke across them and a pan of the view are measured on too: painted full and checkered (ticket 1039). */
const STROKED = new Set(['full frame', 'checkered', 'large full', 'large checkered'])
/** How many moves a stroke or a pan makes, a frame's time apart. */
const MOVES = 60

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
      // A step that ends in the draft look did not draw the Lifted piece: its line says so.
      const draft = drawsDraft(DENSITY * Number(await page.getByTestId('project-surface').getAttribute('data-zoom')))
      lines.push(`${name.padEnd(15)} ${`at ${zoom}%`.padEnd(8)} ${what.padEnd(18)} ${ms.toFixed(0).padStart(6)} ms  ${ms > BUDGET_MS ? `OVER ${BUDGET_MS}` : 'ok'}${draft ? '  (ended in the draft look)' : ''}`)
    }
    /** A press of a zoom button, where the zoom has a step left that way: at its end the button waits for nobody. */
    const zoomStep = async (button: 'zoom-in' | 'zoom-out') => {
      if (await page.getByTestId(button).isEnabled()) await step(`${button === 'zoom-in' ? 'zoom step in' : 'zoom step out'}`, () => page.getByTestId(button).click())
    }
    // Each line is kept as it is measured, so a step that never ends still leaves those before it.
    await step('full redraw', () => page.setViewportSize({ width: 1366, height: 1000 }))
    // A Frame that fits the shorter window only in the draft look (the round ones, at 12%) gets the window back, where it
    // fits in the full look, a full redraw too: the steps after are measured on what an iPad draws.
    if (drawsDraft(DENSITY * Number(await page.getByTestId('project-surface').getAttribute('data-zoom')))) {
      await step('full redraw back', () => page.setViewportSize({ width: 1366, height: 1024 }))
    }
    await step('Progress bar step', () => page.getByTestId('progress-bar-next').click())
    await zoomStep('zoom-in')
    await zoomStep('zoom-out')
    await zoomStep('zoom-out')
    // Last, so the steps before are measured as ticket 1034 measured them, back at the fit, where the full look is drawn.
    if (STROKED.has(name)) {
      await page.getByTestId('zoom-reset').click()
      await page.waitForTimeout(AFTERMATH_MS)
      const surface = (await page.getByTestId('project-surface').boundingBox())!
      const middle = { x: surface.x + surface.width / 2, y: surface.y + surface.height / 2 }
      /** A drag from the middle, MOVES moves each a frame apart, `along` placing each by its index. */
      const drag = async (along: (index: number) => { x: number; y: number }) => {
        for (let index = 0; index <= MOVES; index += 1) {
          const offset = along(index)
          await page.mouse.move(middle.x + offset.x, middle.y + offset.y)
          if (index === 0) await page.mouse.down()
          await settle(page)
        }
        await page.mouse.up()
      }
      // A stroke paints the layer it begins on: from the middle, in the Frame, down and to the right, staying in it.
      await selectTool(page, 'paint')
      await step('stroke', () => drag((index) => ({ x: 3 * index, y: 1.5 * index })))
      await selectTool(page, 'hand')
      // Out to the right 150 px and back, 10 px a move, twice.
      await step('pan', () => drag((index) => ({ x: 10 * (15 - Math.abs((index % 30) - 15)), y: 0 })))
    }
  })
}

test.afterAll(() => {
  console.log(['', `The Lifted piece in WebKit at 2× (tickets 1034, 1039): the longest gap between two frames, under ${BUDGET_MS} ms`, ...lines, ''].join('\n'))
})
